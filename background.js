// background.js - Service Worker FIXED v2.1
// ✅ FIX: getUserMedia Manifest V3 + Auto Token Refresh

const BACKEND_URL = 'wss://salesgenius-backend.onrender.com/stream-audio';
const WEBSITE_URL = 'https://getsalesgenius.com';
const SUPABASE_URL = 'https://obtwneqykrktfedopxwz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idHduZXF5a3JrdGZlZG9weHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MjIxNDUsImV4cCI6MjA3NjE5ODE0NX0.5rNi7BciPrY-eo5nl3pX8sK61hpfbOSPS0yEV2YXi-o';

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
    case 'backend_message':
      // Message forwarded from offscreen document
      handleBackendMessage(message.data);
      break;

    case 'start_capture':
      // Messaggio dall'offscreen document
      console.log('📨 Received start_capture from offscreen');
      sendResponse({ success: true });
      return true;

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
 * 🔄 Refresh automatico del token Supabase
 */
async function refreshAccessToken() {
  try {
    console.log('🔄 Attempting to refresh access token...');
    
    const syncData = await chrome.storage.sync.get('supabase_session');
    const session = syncData.supabase_session;
    
    if (!session || !session.refresh_token) {
      console.warn('⚠️ No refresh token available');
      return null;
    }
    
    // Call Supabase refresh endpoint
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        refresh_token: session.refresh_token
      })
    });
    
    if (!response.ok) {
      console.error('❌ Token refresh failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // Update stored session with new tokens
    const newSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: data.user
    };
    
    await chrome.storage.sync.set({ supabase_session: newSession });
    await chrome.storage.local.set({ supabase_token: data.access_token });
    
    console.log('✅ Token refreshed successfully. New expiry:', new Date(data.expires_at * 1000));
    
    return data.access_token;
    
  } catch (error) {
    console.error('❌ Error refreshing token:', error);
    return null;
  }
}

/**
 * ✅ Verifica se l'utente è autenticato e premium (con auto-refresh)
 */
async function checkUserStatus() {
  try {
    const syncData = await chrome.storage.sync.get('supabase_session');
    const localData = await chrome.storage.local.get('supabase_token');
    const session = syncData.supabase_session;
    let token = session?.access_token || localData.supabase_token;

    if (!token) {
      console.warn('⚠️ No Supabase token found');
      return { isAuthenticated: false, isPremium: false, error: 'No token' };
    }

    // ✅ CHECK: Se token scaduto, prova refresh automatico
    if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
      console.log('⚠️ Token expired, attempting automatic refresh...');
      
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        console.log('✅ Token auto-refreshed successfully');
        token = newToken;
      } else {
        console.warn('❌ Auto-refresh failed, user needs to re-login');
        return { isAuthenticated: false, isPremium: false, error: 'Session expired and refresh failed' };
      }
    }

    // Recupera dati utente da Supabase Auth
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

    // 🔍 Recupera profilo - PROVA ENTRAMBI I CAMPI
    console.log('🔍 Trying to fetch profile for user:', userData.id);
    
    // Prima prova con user_id
    let profileResponse = await fetch(
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
      console.warn('⚠️ Could not fetch profile with user_id, trying id field...');
      
      // Prova con id
      profileResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userData.id}&select=*`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!profileResponse.ok) {
      console.warn('⚠️ Could not fetch profile for user:', userData.id);
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

    console.log('🔍 Profile loaded:', profile);
    console.log('🔍 Profiles array length:', profiles.length);
    console.log('🔍 Profile fields:', {
      is_premium: profile?.is_premium,
      user_id: profile?.user_id,
      email: profile?.email
    });

    // ✅ FIXED: Usa "is_premium" (il campo VERO nella tabella)
    const isPremium =
      profile?.is_premium === true ||
      profile?.is_premium === 'true' ||
      profile?.is_premium === 't' ||
      profile?.is_premium === 1 ||
      // Support per altri formati comuni
      profile?.plan?.toString().toLowerCase() === 'premium' ||
      profile?.plan?.toString().toLowerCase() === 'lifetime' ||
      false;
    
    console.log('✅ isPremium result:', isPremium);

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
 * Controlla autenticazione e stato premium
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

    // Cambia icona a recording
    chrome.action.setIcon({
      path: {
        16: 'assets/icons/icon-recording-16.png',
        48: 'assets/icons/icon-recording-48.png',
        128: 'assets/icons/icon-recording-128.png',
      },
    });

    updateBadge();
    
    // ✅ NUOVO: Inizia audio capture - FIXED VERSION
    await startAudioCapture(authStatus, tab.id);
    
    console.log('✅ Recording started successfully');
    sendResponse({ success: true, sessionData: currentSessionData });
  } catch (error) {
    console.error('❌ Error starting recording:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Ferma la registrazione
 */
async function handleStopRecording(sendResponse) {
  try {
    console.log('🛑 Stopping recording session...');

    const sessionDuration = currentSessionData.startTime
      ? Math.floor((Date.now() - currentSessionData.startTime) / 1000)
      : 0;

    const finalData = { ...currentSessionData, duration: sessionDuration };

    // Stop audio capture
    await stopAudioCapture();

    currentSessionData = {
      isRecording: false,
      sessionId: null,
      startTime: null,
      suggestionsCount: 0,
      currentPlatform: null,
    };

    // Ripristina icona normale
    chrome.action.setIcon({
      path: {
        16: 'assets/icons/icon-16.png',
        48: 'assets/icons/icon-48.png',
        128: 'assets/icons/icon-128.png',
      },
    });

    chrome.action.setBadgeText({ text: '' });

    console.log('✅ Recording stopped');
    sendResponse({ success: true, sessionData: finalData });
  } catch (error) {
    console.error('Error stopping recording:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================================================
// 🎤 AUDIO CAPTURE - MANIFEST V3 VERSION
// ============================================================================

/**
 * ✅ MANIFEST V3: Usa desktopCapture per catturare audio
 * Questo è l'UNICO metodo che funziona in MV3 - usato da Loom, Fireflies, ecc.
 */
async function startAudioCapture(authStatus, tabId) {
  try {
    console.log('🎤 Starting audio capture (Manifest V3 - desktopCapture)...');
    console.log('📋 Tab ID:', tabId);
    
    // PASSO 1: Ottieni l'oggetto tab completo
    const tab = await chrome.tabs.get(tabId);
    console.log('📋 Tab object:', tab);
    
    // PASSO 2: Mostra popup Chrome per scegliere il tab
    // IMPORTANTE: passa l'OGGETTO tab, non il tabId!
    return new Promise((resolve, reject) => {
      chrome.desktopCapture.chooseDesktopMedia(
        ["tab", "audio"], // Cattura tab + audio
        tab, // ← Passa l'OGGETTO tab completo
        (streamId) => {
          if (!streamId) {
            console.warn('⚠️ User cancelled desktop capture');
            reject(new Error('User cancelled capture'));
            return;
          }
          
          console.log('✅ Got streamId from desktopCapture:', streamId);
          
          // PASSO 2: Crea offscreen document per processare l'audio
          setupOffscreenDocument()
            .then(() => {
              // PASSO 3: Invia streamId all'offscreen
              chrome.runtime.sendMessage({
                type: 'start_capture',
                streamId: streamId,
                wsUrl: BACKEND_URL,
                token: authStatus.token
              }, (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                  console.log('✅ Offscreen capture started');
                  resolve();
                } else {
                  reject(new Error(response?.error || 'Offscreen capture failed'));
                }
              });
            })
            .catch(reject);
        }
      );
    });
    
  } catch (error) {
    console.error('❌ Error starting audio capture:', error);
    throw error;
  }
}

/**
 * Crea offscreen document per catturare audio
 */
async function setupOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });
  
  if (existingContexts.length > 0) {
    console.log('✅ Offscreen document already exists');
    return;
  }
  
  // Create offscreen document
  console.log('📄 Creating offscreen document...');
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording audio from tab for AI processing'
  });
  
  console.log('✅ Offscreen document created');
}

/**
 * Connette al WebSocket backend
 */
async function connectWebSocket(token) {
  return new Promise((resolve, reject) => {
    const wsUrl = `${BACKEND_URL}?token=${encodeURIComponent(token)}`;
    console.log('🔌 Connecting to WebSocket...');
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('✅ WebSocket connected');
      
      // Invia hello message
      websocket.send(JSON.stringify({
        op: 'hello',
        version: '2.0',
        client: 'chrome-extension'
      }));
      
      resolve();
    };
    
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleBackendMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    };
    
    websocket.onclose = () => {
      console.log('🔌 WebSocket closed');
      websocket = null;
    };
  });
}

/**
 * ⚠️ NOT USED IN MANIFEST V3 - Audio processing moved to content script
 * (Kept for reference only)
 */
/*
function setupAudioProcessing(stream) {
  try {
    console.log('🎙️ Setting up audio processing...');
    
    // Create AudioContext
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    
    // Create ScriptProcessor for PCM16 conversion
    const bufferSize = 4096;
    processorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
    
    let sequenceNumber = 0;
    
    processorNode.onaudioprocess = (e) => {
      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
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
        websocket.send(JSON.stringify({
          op: 'audio',
          seq: sequenceNumber++,
          sr: 16000,
          ch: 1,
          samples: pcm16.length
        }));
        websocket.send(pcm16.buffer);
      } catch (error) {
        console.error('Error sending audio:', error);
      }
    };
    
    // Connect nodes
    source.connect(processorNode);
    processorNode.connect(audioContext.destination);
    
    console.log('✅ Audio processing started');
    
  } catch (error) {
    console.error('❌ Error setting up audio processing:', error);
    throw error;
  }
}

/**
 * Stop audio capture
 */
async function stopAudioCapture() {
  try {
    console.log('🛑 Stopping audio capture...');
    
    // Disconnect audio nodes
    if (processorNode) {
      processorNode.disconnect();
      processorNode = null;
    }
    
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }
    
    // Stop audio tracks
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
    
    // Close WebSocket
    if (websocket) {
      websocket.close();
      websocket = null;
    }
    
    console.log('✅ Audio capture stopped');
  } catch (error) {
    console.error('Error stopping audio capture:', error);
  }
}

/**
 * Gestisce messaggi dal backend
 */
function handleBackendMessage(data) {
  console.log('📨 Backend message:', data.type);
  
  switch (data.type) {
    case 'auth_success':
      console.log('✅ Backend authentication successful');
      break;
      
    case 'hello_ack':
      console.log('👋 Hello acknowledged by backend');
      break;
      
    case 'suggestion.start':
      console.log(`💡 New suggestion starting: [${data.category}]`);
      currentSessionData.suggestionsCount++;
      updateBadge();
      
      broadcastToTabs({
        type: 'suggestion_start',
        data: data
      });
      break;
      
    case 'suggestion.delta':
      broadcastToTabs({
        type: 'suggestion_delta',
        data: data
      });
      break;
      
    case 'suggestion.end':
      console.log(`✅ Suggestion complete: ${data.fullText}`);
      
      broadcastToTabs({
        type: 'new_suggestion',
        suggestion: {
          id: data.id,
          category: data.category,
          text: data.fullText,
          intent: data.intent,
          timestamp: new Date().toISOString()
        }
      });
      break;
      
    case 'error':
      console.error('❌ Backend error:', data.message);
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon-128.png',
        title: 'SalesGenius Error',
        message: data.message || 'An error occurred',
        priority: 2
      });
      break;
      
    default:
      console.log('Unknown message type:', data.type);
  }
}

/**
 * Broadcast messaggio a tutti i tab con video call
 */
function broadcastToTabs(message) {
  if (currentSessionData.tabId) {
    chrome.tabs.sendMessage(currentSessionData.tabId, message).catch(() => {
      console.log('Could not send to tab');
    });
  }
}

/**
 * Aggiorna il badge con il numero di suggerimenti
 */
function updateBadge() {
  if (currentSessionData.isRecording) {
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    chrome.action.setBadgeText({
      text: currentSessionData.suggestionsCount.toString(),
    });
  }
}

/**
 * Monitora quando l'utente entra in una pagina di video call
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const videoCallPatterns = [
      /zoom\.us\/(j|wc)\//i,
      /meet\.google\.com\/[a-z]/i,
      /teams\.microsoft\.com/i,
      /webex\.com\/meet/i,
      /whereby\.com\//i,
      /meet\.jit\.si\//i,
    ];

    const isVideoCall = videoCallPatterns.some((pattern) => pattern.test(tab.url));
    if (isVideoCall) {
      console.log('🎥 Video call detected:', tab.url);
    }
  }
});

/**
 * Quando l'estensione viene installata
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 SalesGenius Extension v2.1 installed!');
    chrome.tabs.create({ url: `${WEBSITE_URL}/welcome` });
  }
});

/**
 * Quando l'utente clicca l'icona dell'estensione
 */
chrome.action.onClicked.addListener(async (tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'reopen_widget' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('Could not reopen widget:', chrome.runtime.lastError);
    }
  });
});

// ============================================================================
// 🔄 AUTOMATIC TOKEN REFRESH BACKGROUND TASK
// ============================================================================

/**
 * Controlla e refresha il token preventivamente ogni 50 minuti
 * Questo mantiene l'utente loggato indefinitamente
 */
async function backgroundTokenRefresh() {
  try {
    const syncData = await chrome.storage.sync.get('supabase_session');
    const session = syncData.supabase_session;
    
    if (!session || !session.expires_at) {
      return; // Nessuna sessione attiva
    }
    
    const now = Date.now();
    const expiresAt = session.expires_at * 1000;
    const timeUntilExpiry = expiresAt - now;
    
    // Se mancano meno di 10 minuti alla scadenza, refresh preventivo
    if (timeUntilExpiry < 10 * 60 * 1000) {
      console.log('🔄 Preventive token refresh (expires in', Math.floor(timeUntilExpiry / 60000), 'minutes)');
      await refreshAccessToken();
    }
  } catch (error) {
    console.error('Error in background token refresh:', error);
  }
}

// Esegui check ogni 50 minuti (3000 secondi)
chrome.alarms.create('token-refresh', { periodInMinutes: 50 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'token-refresh') {
    console.log('⏰ Running scheduled token refresh check');
    backgroundTokenRefresh();
  }
});

// Esegui anche all'avvio
backgroundTokenRefresh();

console.log('🚀 SalesGenius Background Service Worker v2.1 initialized');
