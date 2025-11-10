// content.js – SalesGenius Extension (Manifest V3)
// Version 2.3.1 – full stable with drag + tabCapture + offscreen

if (window.hasRunSalesGeniusContent) {
  console.log("🟡 SalesGenius content script already active");
} else {
  window.hasRunSalesGeniusContent = true;
  console.log("🎯 SalesGenius content script starting…");

  // ========================================================================
  // ⚙️ Variabili globali
  // ========================================================================
  let isWidgetVisible = false;
  let currentPlatform = null;
  let currentTheme = "light";
  let isDragging = false;
  let currentX = 0,
    currentY = 0,
    initialX = 0,
    initialY = 0,
    xOffset = 0,
    yOffset = 0;

  // Audio globals
  let contentAudioContext = null;
  let contentWebSocket = null;
  let contentProcessorNode = null;

  // ========================================================================
  // 🚀 Init principale
  // ========================================================================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFloatingWidget);
  } else {
    initFloatingWidget();
  }

  new MutationObserver(() => {
    const url = location.href;
    if (!isWidgetVisible && detectPlatform(url)) initFloatingWidget();
  }).observe(document, { subtree: true, childList: true });

  // ========================================================================
  // 🧩 Funzioni principali
  // ========================================================================
  function initFloatingWidget() {
    if (document.getElementById("salesgenius-widget")) return;
    currentPlatform = detectPlatform(window.location.href);
    if (!currentPlatform) return;

    console.log(`✅ Detected platform: ${currentPlatform.name}`);
    createWidget();
    loadTheme();
    isWidgetVisible = true;
  }

  function detectPlatform(url) {
    const platforms = {
      zoom: { pattern: /zoom\.us/i, name: "Zoom" },
      meet: { pattern: /meet\.google\.com/i, name: "Google Meet" },
      teams: { pattern: /teams\.microsoft\.com/i, name: "Microsoft Teams" },
      webex: { pattern: /webex\.com/i, name: "Webex" },
      whereby: { pattern: /whereby\.com/i, name: "Whereby" },
      jitsi: { pattern: /meet\.jit\.si/i, name: "Jitsi Meet" },
    };
    for (const p of Object.values(platforms)) if (p.pattern.test(url)) return p;
    return null;
  }

  function createWidget() {
    const widget = document.createElement("div");
    widget.id = "salesgenius-widget";
    widget.style.cssText = `
      position:fixed; bottom:20px; right:20px; z-index:999999;
      font-family:system-ui,Arial,sans-serif; user-select:none;
      transform:translate(0,0);
    `;
    widget.innerHTML = `
      <button id="sg-start-btn" style="
        background:#7B3FE4;color:#fff;padding:12px 18px;border:none;
        border-radius:10px;cursor:grab;box-shadow:0 2px 8px rgba(0,0,0,0.25);
        font-size:14px;">🎧 Start SalesGenius</button>`;
    document.body.appendChild(widget);

    const btn = document.getElementById("sg-start-btn");
    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "START_CAPTURE" });
      btn.textContent = "🎙️ Listening…";
      btn.style.background = "#E44D26";
    });

    makeDraggable(widget, btn);
    loadWidgetPosition(widget);
    console.log("✅ Widget created");
  }

  // ========================================================================
  // 🎨 Tema
  // ========================================================================
  function loadTheme() {
    chrome.storage.local.get(["sg_theme"], (res) => {
      currentTheme = res.sg_theme || "light";
      document.documentElement.dataset.theme = currentTheme;
    });
  }

  // ========================================================================
  // 🖱️ Drag fluido
  // ========================================================================
  function makeDraggable(widget, handle) {
    let frameId = null;
    handle.addEventListener("mousedown", dragStart, { passive: false });
    handle.addEventListener("touchstart", dragStart, { passive: false });
    document.addEventListener("mousemove", drag);
    document.addEventListener("touchmove", drag, { passive: false });
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("touchend", dragEnd);

    function dragStart(e) {
      e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      initialX = cx - xOffset;
      initialY = cy - yOffset;
      isDragging = true;
      handle.style.cursor = "grabbing";
    }

    function drag(e) {
      if (!isDragging) return;
      e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      currentX = cx - initialX;
      currentY = cy - initialY;
      const margin = 10;
      currentX = Math.max(margin, Math.min(currentX, window.innerWidth - widget.offsetWidth - margin));
      currentY = Math.max(margin, Math.min(currentY, window.innerHeight - widget.offsetHeight - margin));
      xOffset = currentX; yOffset = currentY;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
      });
    }

    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = "grab";
      if (frameId) cancelAnimationFrame(frameId);
      saveWidgetPosition(currentX, currentY);
    }
  }

  function saveWidgetPosition(x, y) {
    chrome.storage.local.set({ sg_widget_position: { x, y } });
  }

  function loadWidgetPosition(widget) {
    chrome.storage.local.get(["sg_widget_position"], (res) => {
      const pos = res.sg_widget_position;
      if (pos) {
        xOffset = pos.x; yOffset = pos.y;
        widget.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      }
    });
  }

  // ========================================================================
  // 🎤 Audio Capture – lato content
  // ========================================================================
  async function setupAudioCaptureFromStreamId(streamId, wsUrl, token) {
    try {
      console.log("🎤 Setting up audio capture with streamId:", streamId);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: streamId,
          },
        },
        video: false,
      });
      console.log("✅ Got audio stream");
      await setupWebSocket(wsUrl, token);
      await setupAudioProcessing(stream);
    } catch (err) {
      console.error("❌ Audio capture error:", err);
    }
  }

  function setupWebSocket(wsUrl, token) {
    return new Promise((resolve, reject) => {
      const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
      console.log("🔌 Connecting WebSocket…");
      contentWebSocket = new WebSocket(url);
      contentWebSocket.onopen = () => {
        console.log("✅ WebSocket connected");
        resolve();
      };
      contentWebSocket.onerror = (err) => {
        console.error("❌ WS error:", err);
        reject(err);
      };
      contentWebSocket.onclose = () => console.log("🔌 WS closed");
    });
  }

  function setupAudioProcessing(stream) {
    return new Promise((resolve, reject) => {
      try {
        contentAudioContext = new AudioContext({ sampleRate: 16000 });
        const source = contentAudioContext.createMediaStreamSource(stream);
        const bufferSize = 4096;
        contentProcessorNode = contentAudioContext.createScriptProcessor(bufferSize, 1, 1);
        contentProcessorNode.onaudioprocess = (e) => {
          if (!contentWebSocket || contentWebSocket.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          contentWebSocket.send(pcm16.buffer);
        };
        source.connect(contentProcessorNode);
        contentProcessorNode.connect(contentAudioContext.destination);
        console.log("✅ Audio processing active");
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  // ========================================================================
  // 🔄 Messaggi background → content
  // ========================================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case "setup_audio_capture":
      case "start_capture":
        setupAudioCaptureFromStreamId(msg.streamId, msg.wsUrl, msg.token)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;

      case "stop_audio":
        stopAudio();
        sendResponse({ success: true });
        break;
    }
  });

  function stopAudio() {
    console.log("🛑 Stopping audio (content)");
    if (contentProcessorNode) contentProcessorNode.disconnect();
    if (contentAudioContext) contentAudioContext.close();
    if (contentWebSocket) contentWebSocket.close();
  }

  console.log("✅ SalesGenius content script loaded v2.3.1");
}
