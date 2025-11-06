// popup/popup.js
// Logica per il popup dell'estensione SalesGenius

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 Popup loaded');

  // Elementi DOM
  const statusSection = document.getElementById('status-section');
  const authSection = document.getElementById('auth-section');
  const premiumSection = document.getElementById('premium-section');
  const mainSection = document.getElementById('main-section');
  
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.querySelector('.status-text');
  const statusDot = document.querySelector('.status-dot');
  
  const loginBtn = document.getElementById('login-btn');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const helpLink = document.getElementById('help-link');
  const privacyLink = document.getElementById('privacy-link');
  const logoutLink = document.getElementById('logout-link');

  const sessionDuration = document.getElementById('session-duration');
  const tipsCount = document.getElementById('tips-count');
  const platformInfo = document.getElementById('platform-info');
  const platformName = document.getElementById('platform-name');
  const recordingStatus = document.getElementById('recording-status');

  // Event Listeners
  loginBtn?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open_login' });
    window.close();
  });

  upgradeBtn?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open_upgrade' });
    window.close();
  });

  helpLink?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://getsalesgenius.com/help' });
  });

  privacyLink?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://getsalesgenius.com/privacy' });
  });

  logoutLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    // Rimuovi token
    await chrome.storage.local.remove(['supabase_token']);
    await chrome.storage.sync.remove(['supabase_session']);
    // Ricarica popup
    location.reload();
  });

  // Controlla stato autenticazione
  await checkAuthStatus();

  // Aggiorna stats ogni 5 secondi se sta registrando
  setInterval(updateStats, 5000);
});

/**
 * Controlla lo stato di autenticazione e mostra un toast
 */
async function checkAuthStatus() {
  const statusText = document.querySelector('.status-text');
  const statusDot = document.querySelector('.status-dot');

  statusText.textContent = 'Checking authentication...';
  
  chrome.runtime.sendMessage({ type: 'check_auth' }, (response) => {
    console.log('Auth status:', response);

    // Rimuove eventuale toast precedente
    const oldToast = document.getElementById('toast');
    if (oldToast) oldToast.remove();

    // Funzione toast temporaneo
    const showToast = (message, color) => {
      const div = document.createElement('div');
      div.id = 'toast';
      div.textContent = message;
      div.style.position = 'fixed';
      div.style.bottom = '10px';
      div.style.left = '10px';
      div.style.padding = '8px 14px';
      div.style.borderRadius = '6px';
      div.style.color = 'white';
      div.style.fontSize = '13px';
      div.style.fontWeight = '600';
      div.style.background = color;
      div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
      div.style.zIndex = '9999';
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 4000);
    };

    if (!response.isAuthenticated) {
      // Non autenticato
      showSection('auth');
      updateStatus('Not signed in', 'gray');
      showToast('🔒 Login required', '#e74c3c');
      return;
    }

    if (!response.isPremium) {
      // Autenticato ma non premium
      showSection('premium');
      updateStatus('Premium required', 'orange');
      showToast('⚠️ Upgrade to Premium', '#f39c12');
      return;
    }

    // ✅ Utente autenticato e premium
    showSection('main');
    updateStatus(`Signed in as ${response.email || 'User'}`, 'green');
    showToast('✅ Premium Active', '#2ecc71');

    // Controlla stato registrazione
    checkRecordingStatus();
  });
}

/**
 * Mostra una specifica sezione
 */
function showSection(section) {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('premium-section').style.display = 'none';
  document.getElementById('main-section').style.display = 'none';

  if (section === 'auth') {
    document.getElementById('auth-section').style.display = 'flex';
  } else if (section === 'premium') {
    document.getElementById('premium-section').style.display = 'flex';
  } else if (section === 'main') {
    document.getElementById('main-section').style.display = 'block';
  }
}

/**
 * Aggiorna lo status indicator
 */
function updateStatus(text, color) {
  const statusText = document.querySelector('.status-text');
  const statusDot = document.querySelector('.status-dot');
  
  statusText.textContent = text;
  
  const colors = {
    green: '#48bb78',
    orange: '#f39c12',
    gray: '#a0aec0',
    red: '#f56565',
  };
  
  statusDot.style.background = colors[color] || colors.gray;
}

/**
 * Controlla se c'è una registrazione in corso
 */
async function checkRecordingStatus() {
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    console.log('Recording status:', response);

    const recordingStatus = document.getElementById('recording-status');
    const platformInfo = document.getElementById('platform-info');
    const platformName = document.getElementById('platform-name');

    if (response.isRecording) {
      recordingStatus.style.display = 'block';
      
      if (response.currentPlatform) {
        platformInfo.style.display = 'flex';
        platformName.textContent = response.currentPlatform.name || 'Unknown';
      }

      // Aggiorna durata e tips count
      updateRecordingStats(response);
    } else {
      recordingStatus.style.display = 'none';
      platformInfo.style.display = 'none';
    }
  });
}

/**
 * Aggiorna le statistiche della registrazione
 */
function updateRecordingStats(status) {
  const sessionDuration = document.getElementById('session-duration');
  const tipsCount = document.getElementById('tips-count');

  if (status.startTime) {
    const duration = Math.floor((Date.now() - status.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    sessionDuration.textContent = `${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  if (status.suggestionsCount !== undefined) {
    tipsCount.textContent = status.suggestionsCount;
  }
}

/**
 * Aggiorna stats periodicamente
 */
async function updateStats() {
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response && response.isRecording) {
      updateRecordingStats(response);
    }
  });
}
