// ALTERNATIVE AUDIO CAPTURE for Manifest V3
// Use this if chrome.tabCapture.capture() doesn't work

/**
 * ✅ ALTERNATIVE: Start audio capture using getMediaStreamId
 */
async function startAudioCaptureV3(authStatus, tabId) {
  try {
    console.log('🎤 Starting audio capture (Manifest V3 method)...');
    
    // Connect WebSocket first
    await connectWebSocket(authStatus.token);
    
    // Method 1: Try getMediaStreamId (Manifest V3)
    return new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId(
        { targetTabId: tabId },
        (streamId) => {
          if (chrome.runtime.lastError) {
            console.error('❌ getMediaStreamId error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (!streamId) {
            reject(new Error('No streamId returned'));
            return;
          }
          
          console.log('✅ Got streamId:', streamId);
          
          // Send streamId to content script to get actual stream
          chrome.tabs.sendMessage(tabId, {
            type: 'start_audio_capture',
            streamId: streamId
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            if (response && response.success) {
              console.log('✅ Audio capture started in content script');
              resolve();
            } else {
              reject(new Error('Content script failed to start capture'));
            }
          });
        }
      );
    });
    
  } catch (error) {
    console.error('❌ Error starting audio capture:', error);
    throw error;
  }
}

// Add this to content.js to handle the streamId:
/*
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'start_audio_capture') {
    const streamId = message.streamId;
    
    navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    }).then(stream => {
      // Setup audio processing here
      setupAudioProcessing(stream);
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error getting media stream:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep channel open for async response
  }
});
*/
