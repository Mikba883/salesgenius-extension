// background.js – Service Worker (MV3)
// Versione 2.3.0 – compatibile con content.js (setup_audio_capture)

// =========================
// 🔧 Costanti di progetto
// =========================
const BACKEND_URL = 'wss://salesgenius-backend.onrender.com/stream-audio';
const WEBSITE_URL = 'https://getsalesgenius.com';
const SUPABASE_URL = 'https://obtwneqykrktfedopxwz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idHduZXF5a3JrdGZlZG9weHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MjIxNDUsImV4cCI6MjA3NjE5ODE0NX0.5rNi7BciPrY-eo5nl3pX8sK61hpfbOSPS0yEV2YXi-o';

// =========================
// 🧠 Stato globale sessione
// =========================
let currentSessionData = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  suggestionsCount: 0,
  currentPlatform: null,
  tabId: null,
};

// Non processiamo più audio nel SW: lo fa il content.js
let websocket = null; // (opzionale, se vuoi dialogare col backend anche dal BG)

// =========================
// 🔌 Messaging router
// =========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 BG message:', message?.type);

  switch (message?.type) {
    case 'check_auth':
      handleCheckAuth(sendResponse);
      return true;

    // Compat: alcuni punti del codice inviano "start_recording"
    case 'start_recording':
    // Nuovo percorso: content.js invia "START_CAPTURE"
    case 'START_CAPTURE': {
      const tabId = sender?.tab?.id ?? currentSessionData.tabId;
      handleStartRecording(message, tabId, sendResponse);
      return true;
    }

    case 'stop_recording':
      handleStopRecording(sendResponse);
      return true;

    case 'new_suggestion':
      currentSessionData.suggestionsCount++;
      updateBadge();
      sendResponse?.({ ok: true });
      break;

    case 'open_login':
      chrome.tabs.create({ url: `${WEBSITE_URL}/login` });
      sendResponse?.({ success: true });
      break;

    case 'open_upgrade':
      chrome.tabs.create({ url: `${WEBSITE_URL}/pricing` });
      sendResponse?.({ success: true });
      break;

    case 'show_notification':
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon-128.png',
        title: 'SalesGenius',
        message: message.message || 'Notification',
        priority: 1,
      });
      sendResponse?.({ success: true });
      break;

    default:
      sendResponse?.({ ok: true });
  }
});

// =========================
// 🔐 Supabase: token refresh
// =========================
async function refreshAccessToken() {
  try {
    const { supabase_session: session } = await chrome.storage.sync.get('supabase_session');
    if (!session?.refresh_token) return null;

    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const newSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: data.user,
    };
    await chrome.storage.sync.set({ supabase_session: newSession });
    await chrome.storage.local.set({ supabase_token: data.access_token });
    return data.access_token;
  } catch {
    return null;
  }
}

async function checkUserStatus() {
  try {
    const { supabase_session: session } = await chrome.storage.sync.get('supabase_session');
    const { supabase_token: localToken } = await chrome.storage.local.get('supabase_token');

    let token = session?.access_token || localToken;
    if (!token) return { isAuthenticated: false, isPremium: false, error: 'No token' };

    // Refresh se scaduto
    if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
      const newTok = await refreshAccessToken();
      if (!newTok) return { isAuthenticated: false, isPremium: false, error: 'Expired' };
      token = newTok;
    }

    // User info
    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!uRes.ok) return { isAuthenticated: false, isPremium: false, error: 'Invalid token' };
    const userData = await uRes.json();

    // Profile (tenta user_id poi id)
    let pRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${userData.id}&select=*`,
      { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY } }
    );
    if (!pRes.ok) {
      pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userData.id}&select=*`,
        { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY } }
      );
    }
    const profiles = pRes.ok ? await pRes.json() : [];
    const profile = profiles[0];

    const isPremium =
      profile?.is_premium === true ||
      profile?.is_premium === 'true' ||
      profile?.is_premium === 't' ||
      profile?.is_premium === 1 ||
      ['premium', 'lifetime'].includes(String(profile?.plan || '').toLowerCase());

    return {
      isAuthenticated: true,
      isPremium,
      userId: userData.id,
      email: userData.email,
      token,
    };
  } catch (error) {
    return { isAuthenticated: false, isPremium: false, error: String(error) };
  }
}

async function handleCheckAuth(sendResponse) {
  const status = await checkUserStatus();
  sendResponse(status);
}

// =========================
// 🎬 Start / Stop recording
// =========================
async function handleStartRecording(message, tabId, sendResponse) {
  try {
    // 1) Check auth/premium
    const auth = await checkUserStatus();
    if (!auth.isAuthenticated)
      return sendResponse({ success: false, error: 'not_authenticated' });
    if (!auth.isPremium)
      return sendResponse({ success: false, error: 'not_premium' });

    // 2) Stato sessione
    currentSessionData = {
      isRecording: true,
      sessionId: `session_${Date.now()}`,
      startTime: Date.now(),
      suggestionsCount: 0,
      currentPlatform: message?.platform || null,
      tabId,
    };

    // 3) Icona attiva
    chrome.action.setIcon({
      path: {
        16: 'assets/icons/icon-recording-16.png',
        48: 'assets/icons/icon-recording-48.png',
        128: 'assets/icons/icon-recording-128.png',
      },
    });
    updateBadge();

    // 4) Ottieni il TAB oggetto (serve a chooseDesktopMedia)
    const tab = await chrome.tabs.get(tabId);

    // 5) Avvia chooser per TAB+AUDIO → streamId
    chrome.desktopCapture.chooseDesktopMedia(['tab', 'audio'], tab, async (streamId) => {
      if (!streamId) {
        // Utente ha annullato
        resetIconAndBadge();
        currentSessionData.isRecording = false;
        return sendResponse({ success: false, error: 'user_cancelled' });
      }

      // 6) Invia al CONTENT lo streamId + wsUrl + token
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'setup_audio_capture',
          streamId,
          wsUrl: BACKEND_URL,
          token: auth.token,
        });

        console.log('✅ setup_audio_capture inviato al content');
        sendResponse({ success: true, sessionData: currentSessionData });
      } catch (err) {
        resetIconAndBadge();
        currentSessionData.isRecording = false;
        sendResponse({ success: false, error: String(err?.message || err) });
      }
    });
  } catch (error) {
    resetIconAndBadge();
    currentSessionData.isRecording = false;
    sendResponse({ success: false, error: String(error?.message || error) });
  }
}

async function handleStopRecording(sendResponse) {
  try {
    const duration = currentSessionData.startTime
      ? Math.floor((Date.now() - currentSessionData.startTime) / 1000)
      : 0;

    const finalData = { ...currentSessionData, duration };

    // 👉 Facoltativo: invia al content un messaggio "stop_audio"
    // (Aggiungi un handler nel content se vuoi chiudere WS/AudioContext da lì)
    if (currentSessionData.tabId) {
      try {
        await chrome.tabs.sendMessage(currentSessionData.tabId, { type: 'stop_audio' });
      } catch {
        // ignorabile
      }
    }

    // Reset stato/icona
    currentSessionData = {
      isRecording: false,
      sessionId: null,
      startTime: null,
      suggestionsCount: 0,
      currentPlatform: null,
      tabId: null,
    };
    resetIconAndBadge();

    sendResponse?.({ success: true, sessionData: finalData });
  } catch (error) {
    sendResponse?.({ success: false, error: String(error) });
  }
}

// =========================
// 🧩 Utility
// =========================
function updateBadge() {
  if (currentSessionData.isRecording) {
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    chrome.action.setBadgeText({
      text: String(currentSessionData.suggestionsCount || ''),
    });
  }
}

function resetIconAndBadge() {
  chrome.action.setIcon({
    path: {
      16: 'assets/icons/icon-16.png',
      48: 'assets/icons/icon-48.png',
      128: 'assets/icons/icon-128.png',
    },
  });
  chrome.action.setBadgeText({ text: '' });
}

// =========================
// 🧭 Hooks di ciclo vita
// =========================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  const videoCallPatterns = [
    /zoom\.us\/(j|wc)\//i,
    /meet\.google\.com/i,
    /teams\.microsoft\.com/i,
    /webex\.com/i,
    /whereby\.com\//i,
    /meet\.jit\.si\//i,
  ];
  if (videoCallPatterns.some((p) => p.test(tab.url))) {
    console.log('🎥 Video call detected:', tab.url);
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 SalesGenius installed!');
    chrome.tabs.create({ url: `${WEBSITE_URL}/welcome` });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'reopen_widget' });
  } catch {
    // content non presente su questo dominio
  }
});

// =========================
// ⏰ Token refresh schedulato
// =========================
async function backgroundTokenRefresh() {
  try {
    const { supabase_session: session } = await chrome.storage.sync.get('supabase_session');
    if (!session?.expires_at) return;
    const msLeft = session.expires_at * 1000 - Date.now();
    if (msLeft < 10 * 60 * 1000) await refreshAccessToken();
  } catch {}
}
chrome.alarms.create('token-refresh', { periodInMinutes: 50 });
chrome.alarms.onAlarm.addListener((a) => a.name === 'token-refresh' && backgroundTokenRefresh());
backgroundTokenRefresh();

