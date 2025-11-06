// offscreen.js - Cattura audio in Manifest V3
// Questo script gira in un contesto separato dove FUNZIONA getUserMedia

let audioContext = null;
let processorNode = null;
let websocket = null;
let audioStream = null;

console.log('🎙️ Offscreen document loaded');

// Ascolta messaggi dal background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Offscreen received:', message.type);
  
  if (message.type === 'start_capture') {
    startAudioCapture(message.streamId, message.wsUrl, message.token)
      .then(() => {
        console.log('✅ Audio capture started in offscreen');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('❌ Error in offscreen capture:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open
  }
  
  if (message.type === 'stop_capture') {
    stopAudioCapture();
    sendResponse({ success: true });
  }
});

async function startAudioCapture(streamId, wsUrl, token) {
  try {
    console.log('🎤 Starting audio capture with streamId:', streamId);
    
    // Connect WebSocket first
    await connectWebSocket(wsUrl, token);
    
    // Get audio stream using the streamId from desktopCapture
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    };
    
    console.log('🎙️ Getting user media...');
    audioStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ Got audio stream');
    
    // Setup audio processing
    setupAudioProcessing(audioStream);
    
  } catch (error) {
    console.error('❌ Error capturing audio:', error);
    throw error;
  }
}

function connectWebSocket(wsUrl, token) {
  return new Promise((resolve, reject) => {
    const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
    console.log('🔌 Connecting WebSocket from offscreen...');
    
    websocket = new WebSocket(url);
    
    websocket.onopen = () => {
      console.log('✅ WebSocket connected from offscreen');
      
      // Send hello
      websocket.send(JSON.stringify({
        op: 'hello',
        version: '2.0',
        client: 'chrome-extension-offscreen'
      }));
      
      resolve();
    };
    
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Backend message:', data.type);
        
        // Forward to background
        chrome.runtime.sendMessage({
          type: 'backend_message',
          data: data
        }).catch(() => {});
        
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    };
    
    websocket.onclose = () => {
      console.log('🔌 WebSocket closed');
    };
  });
}

function setupAudioProcessing(stream) {
  try {
    console.log('🎙️ Setting up audio processing...');
    
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    
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
      
      // Send to backend
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
    
    source.connect(processorNode);
    processorNode.connect(audioContext.destination);
    
    console.log('✅ Audio processing started in offscreen');
    
  } catch (error) {
    console.error('❌ Error setting up audio:', error);
    throw error;
  }
}

function stopAudioCapture() {
  console.log('🛑 Stopping audio capture in offscreen');
  
  if (processorNode) {
    processorNode.disconnect();
    processorNode = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
  if (websocket) {
    websocket.close();
    websocket = null;
  }
}
