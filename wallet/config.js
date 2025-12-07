// /wallet/config.js - Dynamic configuration for Railway
class WalletConfig {
  constructor() {
    this.apiBase = null;
    this.publicUrl = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      // First, try to get the current domain
      const currentDomain = window.location.origin;
      
      // Remove /wallet from path to get backend
      this.publicUrl = currentDomain.replace('/wallet', '');
      this.apiBase = `${this.publicUrl}/api`;
      
      // Try to fetch from server for dynamic Railway URL
      try {
        const response = await fetch(`${this.apiBase}/public-url`);
        if (response.ok) {
          const data = await response.json();
          this.publicUrl = data.publicUrl;
          this.apiBase = data.apiUrl || `${this.publicUrl}/api`;
        }
      } catch (error) {
        console.log('Using derived API URL:', this.apiBase);
      }
      
      // For development
      if (currentDomain.includes('localhost') || currentDomain.includes('127.0.0.1')) {
        this.apiBase = 'http://localhost:3000/api';
        this.publicUrl = 'http://localhost:3000';
      }
      
      this.isInitialized = true;
      console.log('Wallet Config Initialized:', {
        apiBase: this.apiBase,
        publicUrl: this.publicUrl
      });
      
      return this;
    } catch (error) {
      console.error('Wallet Config Error:', error);
      // Fallback - update this with your Railway app name
      this.apiBase = 'https://botomics-production.up.railway.app/api';
      this.publicUrl = 'https://botomics-production.up.railway.app';
      this.isInitialized = true;
      return this;
    }
  }

  getApiEndpoint(path) {
    return `${this.apiBase}${path.startsWith('/') ? path : '/' + path}`;
  }

  getPublicUrl() {
    return this.publicUrl;
  }

  getWalletUrl() {
    return `${this.publicUrl}/wallet`;
  }
}

// Create global instance
window.walletConfig = new WalletConfig();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.walletConfig.init();
  });
} else {
  window.walletConfig.init();
}