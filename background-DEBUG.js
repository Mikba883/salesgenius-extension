// background.js - DEBUG VERSION (Bypass premium check)
// ⚠️ ONLY FOR TESTING! Replace with original after fixing DB

const BACKEND_URL = 'wss://salesgenius-backend.onrender.com/stream-audio';
const WEBSITE_URL = 'https://getsalesgenius.com';
const SUPABASE_URL = 'https://obtwneqykrktfedopxwz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idHduZXF5a3JrdGZlZG9weHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MjIxNDUsImV4cCI6MjA3NjE5ODE0NX0.5rNi7BciPrY-eo5nl3pX8sK61hpfbOSPS0yEV2YXi-o';

// ⚠️ DEBUG MODE: Bypass premium check
const DEBUG_BYPASS_PREMIUM = true;
const DEBUG_EMAIL = 'm.baroni90@gmail.com';

// Stato globale
let currentSessionData = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  suggestionsCount: 0,
  currentPlatform: null,
};

// Audio capture globals
let audioStream = null;
let websocket = null;
let mediaRecorder = null;
let audioContext = null;
let processorNode = null;

/**
 * Gestisce i messaggi dal content script e popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message.type);

  switch (message.type) {
    case 'check_auth':
      handleCheckAuth(sendResponse);
      return true;

    case 'start_recording':
      handleStartRecording(message, sender.tab, sendResponse);
      return true;

    case 'stop_recording':
      handleStopRecording(sendResponse);
      return true;

    case 'get_status':
      sendResponse(currentSessionData);
      break;

    case 'open_login':
      chrome.tabs.create({ url: `${WEBSITE_URL}/login` });
      sendResponse({ success: true });
      break;

    case 'open_upgrade':
      chrome.tabs.create({ url: `${WEBSITE_URL}/pricing` });
      sendResponse({ success: true });
      break;

    case 'new_suggestion':
      currentSessionData.suggestionsCount++;
      updateBadge();
      break;

    case 'show_notification':
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon-128.png',
        title: 'SalesGenius',
        message: message.message || 'Notification',
        priority: 1
      });
      sendResponse({ success: true });
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
});

/**
 * ✅ DEBUG: Verifica auth con bypass premium
 */
async function checkUserStatus() {
  try {
    const syncData = await chrome.storage.sync.get('supabase_session');
    const localData = await chrome.storage.local.get('supabase_token');
    const session = syncData.supabase_session;
    const token = session?.access_token || localData.supabase_token;

    if (!token) {
      console.warn('⚠️ No Supabase token found');
      return { isAuthenticated: false, isPremium: false, error: 'No token' };
    }

    if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
      console.warn('⚠️ Supabase session expired');
      return { isAuthenticated: false, isPremium: false, error: 'Session expired' };
    }

    // Recupera dati utente
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      console.warn('❌ Invalid Supabase token');
      return { isAuthenticated: false, isPremium: false, error: 'Invalid token' };
    }

    const userData = await response.json();
    
    console.log('✅ User authenticated:', userData.email);

    // ⚠️ DEBUG MODE: Bypass premium check
    if (DEBUG_BYPASS_PREMIUM && userData.email === DEBUG_EMAIL) {
      console.log('🚨 DEBUG MODE: Bypassing premium check for', userData.email);
      return {
        isAuthenticated: true,
        isPremium: true, // ⚠️ FORCED TRUE
        userId: userData.id,
        email: userData.email,
        token: token
      };
    }

    // Normal premium check (if not debug user)
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${userData.id}&select=*`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!profileResponse.ok) {
      return {
        isAuthenticated: true,
        isPremium: false,
        email: userData.email,
        userId: userData.id,
        error: 'Profile fetch failed',
      };
    }

    const profiles = await profileResponse.json();
    const profile = profiles[0];

    // ✅ FIXED: Usa "is_premium" (il campo VERO)
    const isPremium =
      profile?.is_premium === true ||
      profile?.is_premium === 'true' ||
      false;

    return {
      isAuthenticated: true,
      isPremium,
      userId: userData.id,
      email: userData.email,
      token: token
    };
  } catch (error) {
    console.error('❌ Error checking user status:', error);
    return { isAuthenticated: false, isPremium: false, error: error.message };
  }
}

/**
 * Controlla autenticazione
 */
async function handleCheckAuth(sendResponse) {
  try {
    const status = await checkUserStatus();
    console.log('✅ Auth check result:', status);
    sendResponse(status);
  } catch (error) {
    console.error('Error checking auth:', error);
    sendResponse({ isAuthenticated: false, isPremium: false, error: error.message });
  }
}

/**
 * Inizia la registrazione
 */
async function handleStartRecording(message, tab, sendResponse) {
  try {
    console.log('🎬 Starting recording session...');

    const authStatus = await checkUserStatus();

    if (!authStatus.isAuthenticated) {
      sendResponse({
        success: false,
        error: 'not_authenticated',
        message: 'Please login first',
      });
      return;
    }

    if (!authStatus.isPremium) {
      sendResponse({
        success: false,
        error: 'not_premium',
        message: 'Premium subscription required',
      });
      return;
    }

    currentSessionData = {
      isRecording: true,
      sessionId: `session_${Date.now()}`,
      startTime: Date.now(),
      suggestionsCount: 0,
      currentPlatform: message.platform,
      tabId: tab.id
    };

    chrome.action.setIcon({
      path: {
        16: 'assets/icons/icon-recording-16.png',
        48: 'assets/icons/icon-recording-48.png',
        128: 'assets/icons/icon-recording-128.png',
      },
    });

    updateBadge();
    
    await startAudioCapture(authStatus, tab.id);
    
    console.log('✅ Recording started successfully');
    sendResponse({ success: true, sessionData: currentSessionData });
  } catch (error) {
    console.error('❌ Error starting recording:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ... REST OF THE FILE IS IDENTICAL TO ORIGINAL background.js
// Copy from line 234 onwards from the original file
