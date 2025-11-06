// utils/platform-detector.js
// Rileva automaticamente le piattaforme di video call

const VIDEO_CALL_PLATFORMS = {
  zoom: {
    pattern: /zoom\.us\/(j|wc)\//i,
    name: 'Zoom',
    icon: '🎥'
  },
  meet: {
    pattern: /meet\.google\.com\/[a-z]/i,
    name: 'Google Meet',
    icon: '📹'
  },
  teams: {
    pattern: /teams\.microsoft\.com/i,
    name: 'Microsoft Teams',
    icon: '💼'
  },
  webex: {
    pattern: /webex\.com\/meet/i,
    name: 'Cisco Webex',
    icon: '🌐'
  },
  whereby: {
    pattern: /whereby\.com\//i,
    name: 'Whereby',
    icon: '📱'
  },
  jitsi: {
    pattern: /meet\.jit\.si\//i,
    name: 'Jitsi Meet',
    icon: '🎙️'
  }
};

class PlatformDetector {
  /**
   * Rileva la piattaforma corrente dall'URL
   */
  static detect(url) {
    for (const [key, platform] of Object.entries(VIDEO_CALL_PLATFORMS)) {
      if (platform.pattern.test(url)) {
        return {
          id: key,
          name: platform.name,
          icon: platform.icon,
          url: url
        };
      }
    }
    return null;
  }

  /**
   * Verifica se l'URL corrente è una video call
   */
  static isVideoCallPage(url) {
    return this.detect(url) !== null;
  }

  /**
   * Ottiene la lista di tutte le piattaforme supportate
   */
  static getSupportedPlatforms() {
    return Object.entries(VIDEO_CALL_PLATFORMS).map(([id, platform]) => ({
      id,
      name: platform.name,
      icon: platform.icon
    }));
  }

  /**
   * Monitora i cambiamenti di URL per rilevare quando si entra in una call
   */
  static startMonitoring(callback) {
    // Controlla l'URL corrente
    const checkCurrentUrl = () => {
      const platform = this.detect(window.location.href);
      callback(platform);
    };

    // Check iniziale
    checkCurrentUrl();

    // Monitora i cambiamenti di URL (per SPA come Meet/Teams)
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        checkCurrentUrl();
      }
    });

    observer.observe(document, {
      subtree: true,
      childList: true
    });

    return observer;
  }
}
