// /wallet/config.js - Dynamic configuration for Railway
class WalletConfig {
  constructor() {
    this.apiBase = null;
    this.publicUrl = null;
    this.isInitialized = false;
    this.isTelegram = false;
    this.telegramUserId = null;
  }

  async init() {
    try {
      console.log('🚀 Initializing Wallet Config...');
      
      // Detect if running inside Telegram
      this.isTelegram = window.Telegram && window.Telegram.WebApp;
      if (this.isTelegram) {
        console.log('📱 Running inside Telegram Web App');
        this.telegramUserId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
      }
      
      // Strategy 1: Get from URL query parameter (for testing)
      const urlParams = new URLSearchParams(window.location.search);
      const apiOverride = urlParams.get('api');
      if (apiOverride) {
        console.log('🔧 Using API override from URL:', apiOverride);
        this.publicUrl = apiOverride;
        this.apiBase = `${apiOverride}/api`;
        this.isInitialized = true;
        return this;
      }
      
      // Strategy 2: Try to fetch from server for dynamic Railway URL
      try {
        // First, get the current origin
        const currentOrigin = window.location.origin;
        
        // Remove /wallet if present to get base URL
        let baseUrl = currentOrigin;
        if (baseUrl.includes('/wallet')) {
          baseUrl = baseUrl.replace('/wallet', '');
        }
        
        console.log('🌐 Current origin:', currentOrigin);
        console.log('🌐 Base URL:', baseUrl);
        
        // Try to fetch public URL from server
        const response = await fetch(`${baseUrl}/api/public-url`);
        if (response.ok) {
          const data = await response.json();
          this.publicUrl = data.publicUrl;
          this.apiBase = data.apiUrl || `${this.publicUrl}/api`;
          console.log('✅ Fetched dynamic URL from server:', this.publicUrl);
        } else {
          // Fallback to current origin
          this.publicUrl = baseUrl;
          this.apiBase = `${baseUrl}/api`;
          console.log('⚠️  Using base URL as fallback:', this.publicUrl);
        }
      } catch (error) {
        console.log('❌ Server fetch failed:', error.message);
        
        // Strategy 3: Check common Railway patterns
        const hostname = window.location.hostname;
        
        if (hostname.includes('railway.app')) {
          // Production Railway URL
          const serviceName = hostname.split('.')[0]; // Get "botomics" from "botomics.up.railway.app"
          this.publicUrl = `https://${hostname}`;
          this.apiBase = `https://${hostname}/api`;
          console.log('🚂 Detected Railway URL:', this.publicUrl);
        } 
        // Strategy 4: Use hardcoded fallback for your specific Railway app
        else {
          // CHANGE THIS TO YOUR ACTUAL RAILWAY APP NAME
          this.publicUrl = 'https://botomics.up.railway.app';
          this.apiBase = 'https://botomics.up.railway.app/api';
          console.log('⚠️  Using hardcoded Railway URL:', this.publicUrl);
        }
      }
      
      // Strategy 5: For Telegram Web App debugging
      if (this.isTelegram) {
        console.log('🤖 Telegram Web App detected');
        console.log('User ID:', this.telegramUserId);
        console.log('Platform:', window.Telegram.WebApp.platform);
        
        // Telegram needs HTTPS - ensure we have it
        if (!this.publicUrl.startsWith('https://')) {
          this.publicUrl = this.publicUrl.replace('http://', 'https://');
          this.apiBase = this.apiBase.replace('http://', 'https://');
        }
      }
      
      this.isInitialized = true;
      
      console.log('✅ Wallet Config Initialized:', {
        apiBase: this.apiBase,
        publicUrl: this.publicUrl,
        isTelegram: this.isTelegram,
        telegramUserId: this.telegramUserId
      });
      
      // Store in localStorage for debugging
      localStorage.setItem('wallet_config', JSON.stringify({
        apiBase: this.apiBase,
        publicUrl: this.publicUrl,
        timestamp: new Date().toISOString()
      }));
      
      return this;
    } catch (error) {
      console.error('❌ Wallet Config Error:', error);
      
      // Ultimate fallback - use your Railway app URL
      this.apiBase = 'https://botomics.up.railway.app/api';
      this.publicUrl = 'https://botomics.up.railway.app';
      this.isInitialized = true;
      
      console.log('🔄 Using ultimate fallback:', this.publicUrl);
      
      return this;
    }
  }

  getApiEndpoint(path) {
    const endpoint = `${this.apiBase}${path.startsWith('/') ? path : '/' + path}`;
    console.log(`🔗 API Endpoint: ${endpoint}`);
    return endpoint;
  }

  getPublicUrl() {
    return this.publicUrl;
  }

  getWalletUrl() {
    const url = `${this.publicUrl}/wallet`;
    console.log(`💰 Wallet URL: ${url}`);
    return url;
  }

  // Helper to test API connection
  async testConnection() {
    try {
      console.log('🧪 Testing API connection...');
      const response = await fetch(this.getApiEndpoint('/health'));
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API Connection successful:', data);
        return { success: true, data };
      }
      return { success: false, status: response.status };
    } catch (error) {
      console.error('❌ API Connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
window.walletConfig = new WalletConfig();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await window.walletConfig.init();
    
    // Test connection on startup
    const connection = await window.walletConfig.testConnection();
    
    // Show connection status in console
    if (connection.success) {
      console.log('🚀 Wallet is ready!');
    } else {
      console.warn('⚠️  Wallet connection issue:', connection);
    }
  });
} else {
  window.walletConfig.init().then(() => {
    window.walletConfig.testConnection();
  });
}