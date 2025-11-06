// utils/supabase.js
// Configurazione Supabase per la Chrome Extension

const SUPABASE_URL = 'https://obtwneqykrktfedopxwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idHduZXF5a3JrdGZlZG9weHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MjIxNDUsImV4cCI6MjA3NjE5ODE0NX0.5rNi7BciPrY-eo5nl3pX8sK61hpfbOSPS0yEV2YXi-o';

class SupabaseClient {
  constructor() {
    this.url = SUPABASE_URL;
    this.key = SUPABASE_ANON_KEY;
  }

  /**
   * Verifica se l'utente è autenticato e premium
   */
  async checkUserStatus() {
    try {
      // Recupera il token dalla storage
      const result = await chrome.storage.local.get(['supabase_token']);
      const token = result.supabase_token;

      if (!token) {
        return {
          isAuthenticated: false,
          isPremium: false,
          error: 'No authentication token found'
        };
      }

      // Verifica il token con Supabase
      const response = await fetch(`${this.url}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': this.key
        }
      });

      if (!response.ok) {
        return {
          isAuthenticated: false,
          isPremium: false,
          error: 'Invalid token'
        };
      }

      const userData = await response.json();

      // Controlla se l'utente è premium dalla tabella user_profiles
      const profileResponse = await fetch(
        `${this.url}/rest/v1/user_profiles?id=eq.${userData.id}&select=*`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': this.key,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!profileResponse.ok) {
        return {
          isAuthenticated: true,
          isPremium: false,
          userId: userData.id,
          error: 'Could not fetch profile'
        };
      }

      const profiles = await profileResponse.json();
      const profile = profiles[0];
      const isPremium = profile?.used === true;

      return {
        isAuthenticated: true,
        isPremium: isPremium,
        userId: userData.id,
        email: userData.email
      };
    } catch (error) {
      console.error('Error checking user status:', error);
      return {
        isAuthenticated: false,
        isPremium: false,
        error: error.message
      };
    }
  }

  /**
   * Salva il token di autenticazione
   */
  async saveToken(token) {
    await chrome.storage.local.set({ supabase_token: token });
  }

  /**
   * Recupera il token di autenticazione
   */
  async getToken() {
    const result = await chrome.storage.local.get(['supabase_token']);
    return result.supabase_token;
  }

  /**
   * Rimuove il token (logout)
   */
  async clearToken() {
    await chrome.storage.local.remove(['supabase_token']);
  }
}

// Esporta un'istanza singleton
const supabase = new SupabaseClient();
