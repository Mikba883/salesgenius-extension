// utils/audio-capture.js
// Gestisce la cattura audio dalla tab usando Chrome Tab Capture API

class AudioCapture {
  constructor() {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.isRecording = false;
    this.websocket = null;
    this.audioContext = null;
  }

  /**
   * Inizia la cattura audio dalla tab corrente
   */
  async start(websocketUrl, authToken) {
    try {
      console.log('🎤 Starting audio capture...');

      // Ottieni lo stream audio dalla tab corrente
      const tab = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab[0].id;

      // Richiedi il permesso di cattura audio
      const streamId = await new Promise((resolve, reject) => {
        chrome.tabCapture.capture(
          {
            audio: true,
            video: false
          },
          (stream) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (stream) {
              resolve(stream);
            } else {
              reject(new Error('No stream returned'));
            }
          }
        );
      });

      this.audioStream = streamId;
      console.log('✅ Audio stream captured');

      // Connetti al WebSocket backend
      await this.connectWebSocket(websocketUrl, authToken);

      // Setup MediaRecorder per processare l'audio
      this.setupMediaRecorder();

      this.isRecording = true;
      return { success: true };

    } catch (error) {
      console.error('❌ Error starting audio capture:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Connette al WebSocket backend
   */
  async connectWebSocket(url, authToken) {
    return new Promise((resolve, reject) => {
      // Aggiungi il token all'URL
      const wsUrl = `${url}?token=${authToken}`;
      
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('✅ WebSocket connected to backend');
        
        // Invia messaggio di hello
        this.websocket.send(JSON.stringify({
          op: 'hello',
          version: '1.0',
          client: 'chrome-extension'
        }));
        
        resolve();
      };

      this.websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };

      this.websocket.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.isRecording = false;
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleBackendMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    });
  }

  /**
   * Setup del MediaRecorder per catturare e inviare l'audio
   */
  setupMediaRecorder() {
    // Usa WebM audio per compatibilità
    const options = {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 16000
    };

    this.mediaRecorder = new MediaRecorder(this.audioStream, options);

    // Invia chunk audio ogni 1 secondo al backend
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.websocket?.readyState === WebSocket.OPEN) {
        // Invia l'audio binario direttamente al backend
        event.data.arrayBuffer().then(buffer => {
          this.websocket.send(buffer);
        });
      }
    };

    this.mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      this.stop();
    };

    // Inizia la registrazione con chunk di 1 secondo
    this.mediaRecorder.start(1000);
    console.log('🎙️ MediaRecorder started');
  }

  /**
   * Gestisce i messaggi ricevuti dal backend
   */
  handleBackendMessage(data) {
    console.log('📨 Message from backend:', data);

    switch (data.type) {
      case 'auth_success':
        console.log('✅ Authentication successful');
        // Notifica al content script
        chrome.runtime.sendMessage({
          type: 'auth_success',
          sessionId: data.sessionId
        });
        break;

      case 'suggestion':
        console.log('💡 New suggestion received:', data.suggestion);
        // Invia al content script per mostrare il popup
        chrome.runtime.sendMessage({
          type: 'new_suggestion',
          suggestion: data.suggestion,
          category: data.category,
          confidence: data.confidence
        });
        break;

      case 'transcript':
        console.log('📝 Transcript:', data.text);
        chrome.runtime.sendMessage({
          type: 'transcript',
          text: data.text,
          isFinal: data.isFinal
        });
        break;

      case 'error':
        console.error('❌ Backend error:', data.message);
        chrome.runtime.sendMessage({
          type: 'error',
          message: data.message
        });
        break;

      case 'hello_ack':
        console.log('👋 Hello acknowledged by backend');
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Ferma la cattura audio
   */
  async stop() {
    console.log('🛑 Stopping audio capture...');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.isRecording = false;
    console.log('✅ Audio capture stopped');

    return { success: true };
  }

  /**
   * Verifica se sta registrando
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      websocketConnected: this.websocket?.readyState === WebSocket.OPEN
    };
  }
}

// Istanza singleton
const audioCapture = new AudioCapture();
