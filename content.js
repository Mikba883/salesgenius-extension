// content.js
// Script iniettato nelle pagine di video call - VERSIONE MIGLIORATA

console.log('🎯 SalesGenius content script loaded v2.1');

// Stato locale
let isWidgetVisible = false;
let isExpanded = false;
let suggestions = [];
let currentPlatform = null;
let currentTheme = 'light'; // Tema di default
let isScreenSharing = false; // Track screen sharing state
let screenShareWarning = null; // Warning element

// Variabili per il drag fluido
let isDragging = false;
let currentX = 0;
let currentY = 0;
let initialX = 0;
let initialY = 0;
let xOffset = 0;
let yOffset = 0;

/**
 * Inizializza il widget fluttuante
 */
function initFloatingWidget() {
  // Controlla se il widget esiste già
  if (document.getElementById('salesgenius-widget')) {
    console.log('✅ Widget already exists');
    return;
  }

  // Rileva la piattaforma
  currentPlatform = detectPlatform();
  
  if (!currentPlatform) {
    console.log('❌ Not a supported video call platform');
    return;
  }

  console.log(`✅ Detected platform: ${currentPlatform.name}`);

  // Crea il widget
  createWidget();
  
  // Carica il tema salvato
  loadTheme();
  
  isWidgetVisible = true;
  
  console.log('✅ Widget initialized successfully');
  
  // Mostra messaggio di benvenuto
  showWelcomeMessage();
  
  // Avvia rilevamento screen sharing
  detectScreenSharing();
}

/**
 * Rileva la piattaforma video call corrente
 */
function detectPlatform() {
  const url = window.location.href;
  const platforms = {
    zoom: { pattern: /zoom\.us\/(j|wc)\//i, name: 'Zoom', icon: '🎥' },
    meet: { pattern: /meet\.google\.com\/[a-z]/i, name: 'Google Meet', icon: '📹' },
    teams: { pattern: /teams\.microsoft\.com/i, name: 'Microsoft Teams', icon: '💼' },
    webex: { pattern: /webex\.com\/meet/i, name: 'Cisco Webex', icon: '🌐' },
    whereby: { pattern: /whereby\.com\//i, name: 'Whereby', icon: '📱' },
    jitsi: { pattern: /meet\.jit\.si\//i, name: 'Jitsi Meet', icon: '🎙️' }
  };

  for (const [id, platform] of Object.entries(platforms)) {
    if (platform.pattern.test(url)) {
      return { id, ...platform };
    }
  }
  return null;
}

/**
 * Crea il widget fluttuante (minimizzato inizialmente)
 */
function createWidget() {
  const widget = document.createElement('div');
  widget.id = 'salesgenius-widget';
  widget.className = 'salesgenius-minimized';
  widget.setAttribute('data-theme', currentTheme);
  
  // Ottieni URL estensione per le icone
  const iconNormal = chrome.runtime.getURL('assets/icons/icon-48.png');
  const iconRecording = chrome.runtime.getURL('assets/icons/icon-recording-48.png');
  
  widget.innerHTML = `
    <div class="sg-widget-container">
      <!-- Header minimizzato -->
      <div class="sg-minimized-header" id="sg-mini-header">
        <div class="sg-logo">
          <div class="sg-icon" style="background-image: url('${iconNormal}');"></div>
          <span class="sg-brand">SalesGenius</span>
        </div>
        <button class="sg-header-btn" id="sg-expand-btn" title="Espandi">
          ▲
        </button>
      </div>

      <!-- Contenuto espanso (nascosto inizialmente) -->
      <div class="sg-expanded-content" id="sg-expanded-content" style="display: none;">
        <div class="sg-header">
          <div class="sg-logo-full">
            <div class="sg-icon-large" style="background-image: url('${iconNormal}');"></div>
            <div>
              <div class="sg-title">SalesGenius</div>
              <div class="sg-subtitle">${currentPlatform?.name || 'Video Call'}</div>
            </div>
          </div>
          
          <div class="sg-header-actions">
            <!-- Toggle Tema -->
            <button class="sg-theme-toggle" id="sg-theme-toggle" title="Cambia tema">
              ${currentTheme === 'light' ? '🌙' : '☀️'}
            </button>
            
            <!-- Pulsante Chiudi (X) -->
            <button class="sg-close-btn" id="sg-close-btn" title="Chiudi">
              ×
            </button>
            
            <!-- Minimizza -->
            <button class="sg-header-btn" id="sg-minimize-btn" title="Minimizza">
              ▼
            </button>
          </div>
        </div>

        <!-- Stato e controlli -->
        <div class="sg-controls">
          <button class="sg-btn sg-btn-primary" id="sg-start-btn">
            <span class="sg-btn-icon">▶</span>
            <span class="sg-btn-text">Start Recording</span>
          </button>
          <button class="sg-btn sg-btn-danger" id="sg-stop-btn" style="display: none;">
            <span class="sg-btn-icon">■</span>
            <span class="sg-btn-text">Stop</span>
          </button>
        </div>

        <!-- Statistiche -->
        <div class="sg-stats" id="sg-stats" style="display: none;">
          <div class="sg-stat">
            <span class="sg-stat-icon">⏱</span>
            <span class="sg-stat-value" id="sg-duration">00:00</span>
            <span class="sg-stat-label">Duration</span>
          </div>
          <div class="sg-stat">
            <span class="sg-stat-icon">💡</span>
            <span class="sg-stat-value" id="sg-tips-count">0</span>
            <span class="sg-stat-label">Tips</span>
          </div>
        </div>

        <!-- Live Tips -->
        <div class="sg-tips-section" id="sg-tips-section" style="display: none;">
          <div class="sg-tips-header">💡 Live Tips</div>
          <div class="sg-tips-list" id="sg-tips-list">
            <div class="sg-tips-empty">Waiting for suggestions...</div>
          </div>
        </div>

        <!-- Loading/Auth states -->
        <div class="sg-message" id="sg-message" style="display: none;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(widget);

  // Salva i percorsi icone per uso futuro
  widget.dataset.iconNormal = iconNormal;
  widget.dataset.iconRecording = iconRecording;

  // Event listeners
  setupEventListeners();

  // Carica posizione salvata
  loadWidgetPosition();

  // Verifica autenticazione
  checkAuthentication();
  
  console.log('✅ Widget DOM created');
}

/**
 * Setup degli event listeners
 */
function setupEventListeners() {
  // Espandi/Minimizza
  document.getElementById('sg-expand-btn')?.addEventListener('click', expandWidget);
  document.getElementById('sg-minimize-btn')?.addEventListener('click', minimizeWidget);
  
  // Chiudi widget (X)
  document.getElementById('sg-close-btn')?.addEventListener('click', closeWidget);
  
  // Toggle tema
  document.getElementById('sg-theme-toggle')?.addEventListener('click', toggleTheme);
  
  // Start/Stop recording
  document.getElementById('sg-start-btn')?.addEventListener('click', startRecording);
  document.getElementById('sg-stop-btn')?.addEventListener('click', stopRecording);

  // Drag fluido migliorato
  makeDraggable();
  
  console.log('✅ Event listeners setup complete');
}

/**
 * Espande il widget
 */
function expandWidget() {
  const widget = document.getElementById('salesgenius-widget');
  const content = document.getElementById('sg-expanded-content');
  const miniHeader = document.getElementById('sg-mini-header');
  
  widget.classList.remove('salesgenius-minimized');
  widget.classList.add('salesgenius-expanded');
  content.style.display = 'block';
  miniHeader.style.display = 'none';
  
  isExpanded = true;
  console.log('✅ Widget expanded');
}

/**
 * Minimizza il widget
 */
function minimizeWidget() {
  const widget = document.getElementById('salesgenius-widget');
  const content = document.getElementById('sg-expanded-content');
  const miniHeader = document.getElementById('sg-mini-header');
  
  widget.classList.remove('salesgenius-expanded');
  widget.classList.add('salesgenius-minimized');
  content.style.display = 'none';
  miniHeader.style.display = 'flex';
  
  isExpanded = false;
  console.log('✅ Widget minimized');
}

/**
 * Chiude completamente il widget (lo nasconde)
 */
function closeWidget() {
  const widget = document.getElementById('salesgenius-widget');
  widget.style.display = 'none';
  isWidgetVisible = false;
  console.log('✅ Widget closed');
  
  // Mostra notifica che può riaprirlo cliccando l'icona
  showNotification('Widget nascosto. Clicca l\'icona dell\'estensione per riaprirlo.');
}

/**
 * Riapre il widget (chiamato dal background)
 */
function reopenWidget() {
  const widget = document.getElementById('salesgenius-widget');
  if (widget) {
    widget.style.display = 'block';
    isWidgetVisible = true;
    minimizeWidget(); // Riapri minimizzato
    console.log('✅ Widget reopened');
  } else {
    // Se non esiste, ricrealo
    initFloatingWidget();
  }
}

/**
 * Toggle tema chiaro/scuro
 */
function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  const widget = document.getElementById('salesgenius-widget');
  widget.setAttribute('data-theme', currentTheme);
  
  // Aggiorna icona del toggle
  const toggleBtn = document.getElementById('sg-theme-toggle');
  toggleBtn.textContent = currentTheme === 'light' ? '🌙' : '☀️';
  
  // Salva preferenza
  saveTheme();
  
  console.log(`✅ Theme changed to: ${currentTheme}`);
}

/**
 * Salva il tema in storage
 */
function saveTheme() {
  chrome.storage.local.set({ 'sg_theme': currentTheme });
}

/**
 * Carica il tema salvato
 */
function loadTheme() {
  chrome.storage.local.get(['sg_theme'], (result) => {
    if (result.sg_theme) {
      currentTheme = result.sg_theme;
      const widget = document.getElementById('salesgenius-widget');
      if (widget) {
        widget.setAttribute('data-theme', currentTheme);
        const toggleBtn = document.getElementById('sg-theme-toggle');
        if (toggleBtn) {
          toggleBtn.textContent = currentTheme === 'light' ? '🌙' : '☀️';
        }
      }
    }
  });
}

/**
 * Verifica autenticazione
 */
async function checkAuthentication() {
  showMessage('Checking authentication...', 'info');

  chrome.runtime.sendMessage({ type: 'check_auth' }, (response) => {
    if (!response) {
      showMessage('Error connecting to extension', 'error');
      return;
    }

    if (!response.isAuthenticated) {
      showMessage('Please <a href="#" id="sg-login-link">login</a> to use SalesGenius', 'warning');
      document.getElementById('sg-login-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ type: 'open_login' });
      });
      return;
    }

    if (!response.isPremium) {
      showMessage('Premium subscription required. <a href="#" id="sg-upgrade-link">Upgrade now</a>', 'warning');
      document.getElementById('sg-upgrade-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ type: 'open_upgrade' });
      });
      return;
    }

    // Tutto ok, pronto per registrare
    hideMessage();
    console.log('✅ User authenticated and premium');
  });
}

/**
 * Inizia la registrazione
 */
async function startRecording() {
  console.log('🎬 Starting recording...');
  
  showMessage('Starting recording...', 'info');

  chrome.runtime.sendMessage({
    type: 'start_recording',
    platform: currentPlatform
  }, (response) => {
    if (!response || !response.success) {
      if (response?.error === 'not_authenticated') {
        showMessage('Please login first', 'error');
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'open_login' });
        }, 2000);
      } else if (response?.error === 'not_premium') {
        showMessage('Premium required', 'error');
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'open_upgrade' });
        }, 2000);
      } else {
        showMessage(`Error: ${response?.error || 'Unknown error'}`, 'error');
      }
      return;
    }

    // Registrazione iniziata
    hideMessage();
    document.getElementById('sg-start-btn').style.display = 'none';
    document.getElementById('sg-stop-btn').style.display = 'flex';
    document.getElementById('sg-stats').style.display = 'flex';
    document.getElementById('sg-tips-section').style.display = 'block';

    // Aggiungi classe recording e cambia icone
    const widget = document.getElementById('salesgenius-widget');
    widget.classList.add('recording');
    
    // Cambia icone a recording
    const iconRecording = widget.dataset.iconRecording;
    const iconSmall = widget.querySelector('.sg-icon');
    const iconLarge = widget.querySelector('.sg-icon-large');
    
    if (iconSmall) iconSmall.style.backgroundImage = `url('${iconRecording}')`;
    if (iconLarge) iconLarge.style.backgroundImage = `url('${iconRecording}')`;

    // Inizia il timer
    startTimer();
    
    console.log('✅ Recording started');
  });
}

/**
 * Ferma la registrazione
 */
async function stopRecording() {
  console.log('🛑 Stopping recording...');
  
  chrome.runtime.sendMessage({ type: 'stop_recording' }, (response) => {
    if (response && response.success) {
      document.getElementById('sg-start-btn').style.display = 'flex';
      document.getElementById('sg-stop-btn').style.display = 'none';
      document.getElementById('sg-stats').style.display = 'none';
      document.getElementById('sg-tips-section').style.display = 'none';
      
      // Rimuovi classe recording e ripristina icone normali
      const widget = document.getElementById('salesgenius-widget');
      widget.classList.remove('recording');
      
      // Ripristina icone normali
      const iconNormal = widget.dataset.iconNormal;
      const iconSmall = widget.querySelector('.sg-icon');
      const iconLarge = widget.querySelector('.sg-icon-large');
      
      if (iconSmall) iconSmall.style.backgroundImage = `url('${iconNormal}')`;
      if (iconLarge) iconLarge.style.backgroundImage = `url('${iconNormal}')`;
      
      stopTimer();
      
      showMessage(`Session completed! ${response.sessionData.suggestionsCount} tips generated`, 'success');
      setTimeout(hideMessage, 5000);
      
      console.log('✅ Recording stopped');
    }
  });
}

/**
 * Timer per la durata della registrazione
 */
let timerInterval = null;
let startTime = null;

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimer() {
  const duration = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const durationEl = document.getElementById('sg-duration');
  if (durationEl) {
    durationEl.textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Aggiunge un nuovo suggerimento alla lista
 */
function addSuggestion(suggestion) {
  const tipsList = document.getElementById('sg-tips-list');
  if (!tipsList) return;
  
  // Rimuovi messaggio vuoto
  const emptyMsg = tipsList.querySelector('.sg-tips-empty');
  if (emptyMsg) emptyMsg.remove();

  // Crea elemento suggerimento
  const tipElement = document.createElement('div');
  tipElement.className = 'sg-tip-item sg-tip-new';
  tipElement.innerHTML = `
    <div class="sg-tip-category">${suggestion.category || 'Tip'}</div>
    <div class="sg-tip-text">${suggestion.text || suggestion.suggestion}</div>
    <div class="sg-tip-time">${new Date().toLocaleTimeString()}</div>
  `;

  // Aggiungi in cima alla lista
  tipsList.insertBefore(tipElement, tipsList.firstChild);

  // Rimuovi animazione dopo un po'
  setTimeout(() => {
    tipElement.classList.remove('sg-tip-new');
  }, 2000);

  // Mantieni solo gli ultimi 10 suggerimenti
  const tips = tipsList.querySelectorAll('.sg-tip-item');
  if (tips.length > 10) {
    tips[tips.length - 1].remove();
  }

  // Aggiorna contatore
  const countEl = document.getElementById('sg-tips-count');
  if (countEl) {
    const currentCount = parseInt(countEl.textContent);
    countEl.textContent = currentCount + 1;
  }

  suggestions.push(suggestion);
  
  console.log('💡 New suggestion added:', suggestion);
}

/**
 * Mostra un messaggio
 */
function showMessage(text, type = 'info') {
  const messageEl = document.getElementById('sg-message');
  if (messageEl) {
    messageEl.innerHTML = text;
    messageEl.className = `sg-message sg-message-${type}`;
    messageEl.style.display = 'block';
  }
}

/**
 * Nasconde il messaggio
 */
function hideMessage() {
  const messageEl = document.getElementById('sg-message');
  if (messageEl) {
    messageEl.style.display = 'none';
  }
}

/**
 * Mostra notifica browser
 */
function showNotification(message) {
  chrome.runtime.sendMessage({
    type: 'show_notification',
    message: message
  });
}

/**
 * Mostra messaggio di benvenuto quando il widget si carica
 */
function showWelcomeMessage() {
  const messageEl = document.getElementById('sg-message');
  if (!messageEl) return;
  
  // Messaggio di benvenuto con animazione
  messageEl.innerHTML = `
    <div style="text-align: center; padding: 10px;">
      <div style="font-size: 24px; margin-bottom: 8px;">👋</div>
      <div style="font-weight: 600; margin-bottom: 4px;">Benvenuto in SalesGenius!</div>
      <div style="font-size: 13px; opacity: 0.9;">Clicca "Start Recording" per ricevere suggerimenti AI in tempo reale durante la chiamata</div>
    </div>
  `;
  messageEl.className = 'sg-message sg-message-info';
  messageEl.style.display = 'block';
  messageEl.style.animation = 'fadeIn 0.5s ease-in';
  
  // Nascondi automaticamente dopo 8 secondi
  setTimeout(() => {
    messageEl.style.animation = 'fadeOut 0.5s ease-out';
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 500);
  }, 8000);
}

/**
 * Rileva se utente sta condividendo schermo
 */
function detectScreenSharing() {
  // Check periodicamente se c'è uno stream attivo
  setInterval(() => {
    // Cerca indicatori di screen sharing nella pagina
    const isSharing = checkScreenShareIndicators();
    
    if (isSharing && !isScreenSharing) {
      // Appena iniziato a condividere
      isScreenSharing = true;
      handleScreenShareStart();
    } else if (!isSharing && isScreenSharing) {
      // Appena smesso di condividere
      isScreenSharing = false;
      handleScreenShareStop();
    }
  }, 2000); // Check ogni 2 secondi
}

/**
 * Controlla indicatori di screen sharing sulla pagina
 */
function checkScreenShareIndicators() {
  // Google Meet indicators
  const meetSharingButton = document.querySelector('[aria-label*="Stop presenting"], [data-is-presenting="true"]');
  if (meetSharingButton) return true;
  
  // Zoom indicators
  const zoomSharingIndicator = document.querySelector('[class*="sharing"], [class*="screen-share"]');
  if (zoomSharingIndicator && zoomSharingIndicator.textContent.includes('sharing')) return true;
  
  // Teams indicators
  const teamsSharingButton = document.querySelector('[title*="Stop sharing"]');
  if (teamsSharingButton) return true;
  
  // Generic check: cerca testo "presenting", "sharing" nel DOM
  const bodyText = document.body.innerText.toLowerCase();
  if (bodyText.includes('stop presenting') || bodyText.includes('stop sharing')) {
    return true;
  }
  
  return false;
}

/**
 * Gestisce inizio screen share
 */
function handleScreenShareStart() {
  console.log('⚠️ Screen sharing detected');
  
  // Mostra warning
  showScreenShareWarning();
}

/**
 * Gestisce fine screen share
 */
function handleScreenShareStop() {
  console.log('✅ Screen sharing stopped');
  
  // Rimuovi warning se presente
  if (screenShareWarning) {
    screenShareWarning.remove();
    screenShareWarning = null;
  }
}

/**
 * Mostra warning per screen share
 */
function showScreenShareWarning() {
  // Non mostrare se già presente
  if (screenShareWarning) return;
  
  // Crea warning element
  screenShareWarning = document.createElement('div');
  screenShareWarning.className = 'sg-screen-share-warning';
  screenShareWarning.innerHTML = `
    <div class="sg-warning-header">
      <span class="sg-warning-icon">⚠️</span>
      <span>Screen Sharing Active</span>
    </div>
    <div class="sg-warning-text">
      Participants may see the SalesGenius widget if you're sharing your entire screen or the Meet tab.
      <br><strong>Tip:</strong> Share a specific tab or window instead.
    </div>
    <div class="sg-warning-actions">
      <button class="sg-warning-btn sg-warning-btn-hide" id="sg-warning-hide-widget">
        Hide Widget
      </button>
      <button class="sg-warning-btn sg-warning-btn-dismiss" id="sg-warning-dismiss">
        Got It
      </button>
    </div>
  `;
  
  document.body.appendChild(screenShareWarning);
  
  // Event listeners
  document.getElementById('sg-warning-hide-widget')?.addEventListener('click', () => {
    const widget = document.getElementById('salesgenius-widget');
    if (widget) {
      widget.style.display = 'none';
      isWidgetVisible = false;
    }
    screenShareWarning.remove();
    screenShareWarning = null;
  });
  
  document.getElementById('sg-warning-dismiss')?.addEventListener('click', () => {
    screenShareWarning.remove();
    screenShareWarning = null;
  });
  
  // Auto-dismiss dopo 10 secondi
  setTimeout(() => {
    if (screenShareWarning && screenShareWarning.parentNode) {
      screenShareWarning.remove();
      screenShareWarning = null;
    }
  }, 10000);
}

/**
 * Rende il widget draggable - VERSIONE SUPER FLUIDA
 */
function makeDraggable() {
  const widget = document.getElementById('salesgenius-widget');
  if (!widget) return;

  const miniHeader = document.getElementById('sg-mini-header');
  const expandedHeader = document.querySelector('.sg-header');

  let animationFrameId = null;

  // Applica listener a entrambi gli header
  [miniHeader, expandedHeader].forEach(header => {
    if (!header) return;

    header.addEventListener('mousedown', dragStart, { passive: false });
    header.addEventListener('touchstart', dragStart, { passive: false });
  });

  document.addEventListener('mousemove', drag);
  document.addEventListener('touchmove', drag, { passive: false });
  
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('touchend', dragEnd);

  function dragStart(e) {
    // Non draggare se click su bottoni
    if (e.target.closest('button')) return;

    // Previeni selezione testo
    e.preventDefault();

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    initialX = clientX - xOffset;
    initialY = clientY - yOffset;
    
    isDragging = true;
    widget.classList.add('dragging');
    widget.style.cursor = 'grabbing';
    
    // Rimuovi transizioni per drag fluido
    widget.style.transition = 'none';
  }

  function drag(e) {
    if (!isDragging) return;

    e.preventDefault();

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    currentX = clientX - initialX;
    currentY = clientY - initialY;

    xOffset = currentX;
    yOffset = currentY;

    // Limiti dello schermo con margini
    const margin = 10;
    const maxX = window.innerWidth - widget.offsetWidth - margin;
    const maxY = window.innerHeight - widget.offsetHeight - margin;

    currentX = Math.max(margin, Math.min(currentX, maxX));
    currentY = Math.max(margin, Math.min(currentY, maxY));

    // Usa requestAnimationFrame per performance ottimale
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    
    animationFrameId = requestAnimationFrame(() => {
      widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });
  }

  function dragEnd() {
    if (!isDragging) return;
    
    isDragging = false;
    widget.classList.remove('dragging');
    widget.style.cursor = 'move';
    
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // Ripristina transizioni smooth dopo un breve delay
    setTimeout(() => {
      widget.style.transition = 'transform 0.2s ease-out, box-shadow 0.2s ease-out';
    }, 50);
    
    // Salva posizione
    saveWidgetPosition(currentX, currentY);
  }
}

/**
 * Salva la posizione del widget
 */
function saveWidgetPosition(x, y) {
  chrome.storage.local.set({
    'sg_widget_position': { x, y }
  });
}

/**
 * Salva la posizione salvata del widget
 */
function loadWidgetPosition() {
  chrome.storage.local.get(['sg_widget_position'], (result) => {
    if (result.sg_widget_position) {
      const widget = document.getElementById('salesgenius-widget');
      if (widget) {
        const { x, y } = result.sg_widget_position;
        xOffset = x;
        yOffset = y;
        currentX = x;
        currentY = y;
        widget.style.transform = `translate(${x}px, ${y}px)`;
      }
    }
  });
}

// ============================================================================
// 🎤 AUDIO CAPTURE - MANIFEST V3 (Content Script)
// ============================================================================

let contentAudioContext = null;
let contentWebSocket = null;
let contentProcessorNode = null;

/**
 * ✅ MANIFEST V3: Setup audio capture usando streamId
 */
async function setupAudioCaptureFromStreamId(streamId, wsUrl, token) {
  try {
    console.log('🎤 Setting up audio capture with streamId:', streamId);
    
    // Ottieni stream usando streamId (Manifest V3 syntax)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      },
      video: false
    });
    
    console.log('✅ Got audio stream from tab');
    
    // Connetti WebSocket
    await setupWebSocket(wsUrl, token);
    
    // Setup audio processing
    await setupAudioProcessing(stream);
    
    console.log('✅ Audio capture fully configured');
    
  } catch (error) {
    console.error('❌ Error in setupAudioCaptureFromStreamId:', error);
    throw error;
  }
}

/**
 * Setup WebSocket connection
 */
function setupWebSocket(wsUrl, token) {
  return new Promise((resolve, reject) => {
    const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
    console.log('🔌 Connecting WebSocket from content script...');
    
    contentWebSocket = new WebSocket(url);
    
    contentWebSocket.onopen = () => {
      console.log('✅ WebSocket connected from content script');
      
      // Send hello message
      contentWebSocket.send(JSON.stringify({
        op: 'hello',
        version: '2.0',
        client: 'chrome-extension-content'
      }));
      
      resolve();
    };
    
    contentWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Messages handled by background script, but log for debug
        console.log('📨 WebSocket message:', data.type);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    contentWebSocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    };
    
    contentWebSocket.onclose = () => {
      console.log('🔌 WebSocket closed');
      contentWebSocket = null;
    };
  });
}

/**
 * Setup audio processing with Web Audio API
 */
function setupAudioProcessing(stream) {
  return new Promise((resolve, reject) => {
    try {
      console.log('🎙️ Setting up audio processing...');
      
      // Create AudioContext
      contentAudioContext = new AudioContext({ sampleRate: 16000 });
      const source = contentAudioContext.createMediaStreamSource(stream);
      
      // Create ScriptProcessor for PCM16 conversion
      const bufferSize = 4096;
      contentProcessorNode = contentAudioContext.createScriptProcessor(bufferSize, 1, 1);
      
      let sequenceNumber = 0;
      
      contentProcessorNode.onaudioprocess = (e) => {
        if (!contentWebSocket || contentWebSocket.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send audio header + binary data
        try {
          contentWebSocket.send(JSON.stringify({
            op: 'audio',
            seq: sequenceNumber++,
            sr: 16000,
            ch: 1,
            samples: pcm16.length
          }));
          contentWebSocket.send(pcm16.buffer);
        } catch (error) {
          console.error('Error sending audio:', error);
        }
      };
      
      // Connect nodes
      source.connect(contentProcessorNode);
      contentProcessorNode.connect(contentAudioContext.destination);
      
      console.log('✅ Audio processing started in content script');
      resolve();
      
    } catch (error) {
      console.error('❌ Error setting up audio processing:', error);
      reject(error);
    }
  });
}

// ============================================================================

/**
 * Ascolta messaggi dal background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content script received:', message.type);

  switch (message.type) {
    case 'new_suggestion':
      addSuggestion(message.suggestion);
      chrome.runtime.sendMessage({ type: 'new_suggestion' }); // Notifica al background
      break;

    case 'transcript':
      console.log('📝 Transcript:', message.text);
      break;

    case 'error':
      showMessage(`Error: ${message.message}`, 'error');
      break;

    case 'auth_success':
      console.log('✅ Auth success');
      checkAuthentication();
      break;
      
    case 'reopen_widget':
      reopenWidget();
      break;
      
    case 'setup_audio_capture':
      // ✅ MANIFEST V3: Riceve streamId dal background e avvia capture
      setupAudioCaptureFromStreamId(message.streamId, message.wsUrl, message.token)
        .then(() => {
          console.log('✅ Audio capture started in content script');
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('❌ Audio capture failed:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
  }

  sendResponse({ received: true });
  return true;
});

// Inizializza quando la pagina è pronta
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatingWidget);
} else {
  initFloatingWidget();
}

// Monitora cambiamenti URL (per SPA come Meet)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (!isWidgetVisible) {
      initFloatingWidget();
    }
  }
}).observe(document, { subtree: true, childList: true });

console.log('✅ SalesGenius content script initialized v2.1');
