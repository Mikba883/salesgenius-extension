// offscreen.js - Cattura audio in Manifest V3 (SalesGenius)
// Funziona in un contesto separato dove è permesso getUserMedia

let audioContext = null;
let processorNode = null;
let websocket = null;
let audioStream = null;

console.log("🎧 SalesGenius Offscreen document loaded");

// 🎯 Ascolta messaggi dal background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 Offscreen received:", message.type);

  if (message.type === "start_capture") {
    startAudioCapture(message.streamId, message.wsUrl, message.token)
      .then(() => {
        console.log("✅ Audio capture started in offscreen");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("❌ Error in offscreen capture:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open
  }

  if (message.type === "stop_capture") {
    stopAudioCapture();
    sendResponse({ success: true });
  }
});

/**
 * Avvia la cattura audio usando streamId fornito da desktopCapture
 */
async function startAudioCapture(streamId, wsUrl, token) {
  try {
    console.log("🎤 Starting audio capture with streamId:", streamId);

    // Connessione WebSocket
    await connectWebSocket(wsUrl, token);

    // Ottieni audio stream con il streamId fornito
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    };

    console.log("🎙️ Requesting user media with constraints:", constraints);
    audioStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log("✅ Got audio stream");

    // Setup AudioContext
    await setupAudioProcessing(audioStream);
  } catch (error) {
    console.error("❌ Error capturing audio:", error);
    throw error;
  }
}

/**
 * Connessione WebSocket al backend
 */
function connectWebSocket(wsUrl, token) {
  return new Promise((resolve, reject) => {
    const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
    console.log("🔌 Connecting WebSocket from offscreen:", url);

    websocket = new WebSocket(url);

    websocket.onopen = () => {
      console.log("✅ WebSocket connected from offscreen");

      // Invia messaggio di handshake
      websocket.send(
        JSON.stringify({
          op: "hello",
          version: "2.0",
          client: "chrome-extension-offscreen",
        })
      );
      resolve();
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📨 Backend message:", data.type);

        // Inoltra al background
        chrome.runtime
          .sendMessage({
            type: "backend_message",
            data: data,
          })
          .catch(() => {});
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    websocket.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      reject(error);
    };

    websocket.onclose = () => {
      console.log("🔌 WebSocket closed");
    };
  });
}

/**
 * Setup AudioContext e conversione Float32 → Int16 PCM
 */
async function setupAudioProcessing(stream) {
  console.log("🎙️ Setting up audio processing...");

  // Crea AudioContext
  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);

  const bufferSize = 4096;
  const useProcessor = typeof audioContext.createScriptProcessor === "function";

  let sequenceNumber = 0;

  if (useProcessor) {
    // ✅ Vecchio metodo (compatibile con Chrome attuale)
    processorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

    processorNode.onaudioprocess = (e) => {
      if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = floatTo16BitPCM(inputData);

      try {
        websocket.send(
          JSON.stringify({
            op: "audio",
            seq: sequenceNumber++,
            sr: 16000,
            ch: 1,
            samples: pcm16.length,
          })
        );
        websocket.send(pcm16.buffer);
      } catch (error) {
        console.error("Error sending audio:", error);
      }
    };

    source.connect(processorNode);
    processorNode.connect(audioContext.destination);
    console.log("✅ Audio processing started (ScriptProcessor)");
  } else {
    // 🚀 Nuovo metodo (fallback per browser futuri)
    console.warn("⚠️ Using AudioWorklet fallback...");
    await audioContext.audioWorklet.addModule(chrome.runtime.getURL("pcm-processor.js"));
    const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
    source.connect(workletNode);
    workletNode.port.onmessage = (e) => {
      if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
      websocket.send(JSON.stringify(e.data.header));
      websocket.send(e.data.buffer);
    };
  }
}

/**
 * Conversione Float32Array → Int16Array PCM
 */
function floatTo16BitPCM(float32Array) {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

/**
 * Ferma la cattura audio e chiude tutto in sicurezza
 */
function stopAudioCapture() {
  console.log("🛑 Stopping audio capture in offscreen");

  try {
    if (processorNode) {
      processorNode.disconnect();
      processorNode = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      audioStream = null;
    }

    if (websocket) {
      websocket.close();
      websocket = null;
    }

    console.log("✅ Audio capture fully stopped");
  } catch (error) {
    console.error("❌ Error stopping audio capture:", error);
  }
}
