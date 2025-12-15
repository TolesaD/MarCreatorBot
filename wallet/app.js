// wallet/app.js - COMPLETE FIXED VERSION
const tg = window.Telegram.WebApp;

// Initialize Telegram Web App
tg.ready();
tg.expand();
tg.enableClosingConfirmation();

// Global state
let currentUser = null;
let currentBalance = null;
let currentSubscription = null;
let currentTransactions = [];
let currentPage = 1;
let totalPages = 1;
let currentBotId = null; // Track current bot context

// Configuration
let API_BASE_URL = '';
let PUBLIC_URL = '';

// Track if data is being loaded to prevent duplicate calls
let isLoadingData = false;
let lastDataRefresh = null;
const REFRESH_INTERVAL = 30000; // Refresh data every 30 seconds

// Initialize app
async function initializeApp() {
  try {
    console.log('🚀 Initializing Botomics Wallet...');
    
    // Get configuration from backend
    await loadConfig();
    
    // Validate Telegram session
    if (!tg.initData || tg.initData.length < 20) {
      showAlert('Authentication failed. Please open from @BotomicsBot', 'error');
      return;
    }
    
    // Get bot_id from URL or init data
    const urlParams = new URLSearchParams(window.location.search);
    currentBotId = urlParams.get('bot_id') || 
                   tg.initDataUnsafe?.start_param?.split('_')[1] || 
                   '0'; // Default to platform bot
    
    console.log('Current bot context:', currentBotId);
    
    // Show user info immediately
    showUserInfo();
    
    // Load data immediately when wallet opens
    await refreshAllData();
    
    console.log('✅ Botomics Wallet initialized successfully');
    
    // Set up auto-refresh interval (every 30 seconds)
    setInterval(async () => {
      if (document.visibilityState === 'visible' && !isLoadingData) {
        await refreshAllData();
      }
    }, REFRESH_INTERVAL);
    
    // Refresh data when window becomes visible
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && !isLoadingData) {
        await refreshAllData();
      }
    });
    
    // Also refresh data when returning to main section
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const mainContainer = document.getElementById('mainContainer');
            if (mainContainer && !mainContainer.classList.contains('hidden')) {
              // Wallet is visible, refresh data
              setTimeout(async () => {
                if (!isLoadingData) {
                  await refreshAllData();
                }
              }, 500);
            }
          }
        });
      });
      
      observer.observe(mainContainer, { attributes: true });
    }
    
    // Adjust balance card height for better visibility
    adjustBalanceCardHeight();
    
  } catch (error) {
    console.error('❌ Initialization error:', error);
    
    // Only show alert for critical errors
    if (error.message.includes('Authentication failed') || 
        error.message.includes('Telegram session')) {
      showAlert(error.message, 'error');
    }
  }
}

// Adjust balance card height to show quick actions
function adjustBalanceCardHeight() {
  const balanceCard = document.querySelector('.balance-card');
  if (balanceCard) {
    balanceCard.style.minHeight = 'auto';
    balanceCard.style.padding = '20px 15px';
  }
}

// Refresh all data
async function refreshAllData() {
  if (isLoadingData) return;
  
  isLoadingData = true;
  try {
    console.log('🔄 Refreshing all data...');
    
    // Show loading state only if not already loading
    const balanceEl = document.getElementById('balanceAmount');
    if (balanceEl && !balanceEl.innerHTML.includes('Loading')) {
      balanceEl.innerHTML = `
        <div style="font-size: 32px; font-weight: bold; color: rgba(255,255,255,0.9);">
          🔄 Loading...
        </div>
      `;
    }
    
    // Load all data in sequence to prevent race conditions
    await loadBalance();
    await Promise.all([
      loadSubscription().catch(e => console.error('Subscription load failed:', e)),
      loadHistory().catch(e => console.error('History load failed:', e))
    ]);
    
    lastDataRefresh = new Date();
    console.log(`✅ Data refreshed at ${lastDataRefresh.toLocaleTimeString()}`);
    
  } catch (error) {
    console.error('Refresh all data error:', error);
  } finally {
    isLoadingData = false;
  }
}

// Load configuration from backend
async function loadConfig() {
  try {
    console.log('🔧 Loading configuration...');
    
    // Get current URL
    const currentUrl = window.location.href;
    console.log('Current URL:', currentUrl);
    
    // SIMPLE APPROACH: Always calculate API base from root
    const urlObj = new URL(currentUrl);
    const origin = urlObj.origin; // e.g., https://your-domain.com
    
    // If path contains /wallet, remove it for API base
    let apiBaseUrl;
    if (urlObj.pathname.includes('/wallet')) {
      // We're in /wallet directory
      apiBaseUrl = `${origin}/api`;
      PUBLIC_URL = origin;
    } else {
      // We're at root
      apiBaseUrl = `${origin}/api`;
      PUBLIC_URL = origin;
    }
    
    API_BASE_URL = apiBaseUrl;
    
    console.log('✅ Calculated URLs:', {
      API_BASE_URL,
      PUBLIC_URL,
      pathname: urlObj.pathname
    });
    
    // Quick API test without abort signal (simpler)
    try {
      const testResponse = await fetch(`${API_BASE_URL}/wallet/health`);
      if (testResponse.ok) {
        const data = await testResponse.json();
        console.log('✅ API health check passed:', data);
      } else {
        console.warn('⚠️ API health check failed:', testResponse.status);
      }
    } catch (healthError) {
      console.warn('⚠️ API health check skipped:', healthError.message);
    }
    
    return { API_BASE_URL, PUBLIC_URL };
    
  } catch (error) {
    console.error('❌ Config load error:', error);
    
    // Hardcoded fallback - REPLACE WITH YOUR ACTUAL DOMAIN
    const defaultDomain = 'https://botomics.up.railway.app'; // CHANGE THIS
    API_BASE_URL = `${defaultDomain}/api`;
    PUBLIC_URL = defaultDomain;
    
    console.log('🔄 Using hardcoded URLs:', { API_BASE_URL, PUBLIC_URL });
    
    return { API_BASE_URL, PUBLIC_URL };
  }
}

// Show user info
function showUserInfo() {
  const user = tg.initDataUnsafe?.user;
  if (user) {
    currentUser = user;
    document.getElementById('userInfo').innerHTML = `
      <strong>${user.first_name}</strong>${user.username ? ` (@${user.username})` : ''}<br>
      <small>ID: ${user.id}</small>
    `;
    document.getElementById('userId').textContent = `ID: ${user.id}`;
  } else {
    document.getElementById('userInfo').innerHTML = `
      <span>User not available</span><br>
      <small>Open from Telegram bot</small>
    `;
  }
}

// Load balance
async function loadBalance() {
  try {
    if (!currentUser?.id) {
      // Try to get user from Telegram init data
      const user = tg.initDataUnsafe?.user;
      if (!user?.id) {
        console.error('User not available in loadBalance');
        throw new Error('User not available');
      }
      currentUser = user;
    }
    
    console.log(`📊 Getting balance for user ${currentUser.id}`);
    console.log(`API URL: ${API_BASE_URL}/wallet/balance?userId=${currentUser.id}`);
    
    const response = await fetch(`${API_BASE_URL}/wallet/balance?userId=${currentUser.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData || ''
      }
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      let errorText = 'Failed to load balance';
      try {
        const errorData = await response.json();
        errorText = errorData.error || errorText;
      } catch (e) {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }
      console.error('Balance API error:', errorText);
      throw new Error(errorText);
    }
    
    const data = await response.json();
    console.log('Balance response received:', data.success ? '✅' : '❌');
    
    if (data.success && data.wallet) {
      currentBalance = data.wallet;
      updateBalanceUI(data.wallet);
      return data.wallet;
    } else {
      const errorMsg = data.error || 'Invalid balance response';
      console.error('Balance data error:', errorMsg);
      throw new Error(errorMsg);
    }
    
  } catch (error) {
    console.error('Balance load error:', error.message);
    
    // Show fallback UI but DON'T show alert
    const balanceEl = document.getElementById('balanceAmount');
    if (balanceEl) {
      balanceEl.innerHTML = `
        <div style="font-size: 32px; font-weight: bold; color: rgba(255,255,255,0.9);">
          0.00 <span style="font-size: 22px;">BOM</span>
        </div>
        <div style="color: rgba(255,255,255,0.9); margin-top: 5px; font-size: 14px;">$0.00 USD</div>
        <div style="color: #ffcc00; font-size: 11px; margin-top: 5px; font-weight: bold;">
          ⚠️ Tap refresh to load balance
        </div>
      `;
    }
    
    // Update wallet status to show error
    const statusEl = document.getElementById('walletStatus');
    if (statusEl) {
      statusEl.innerHTML = '<span style="color: #ffcc00; font-weight: bold;">⚠️ Tap refresh</span>';
    }
    
    throw error; // Re-throw so caller knows it failed
  }
}

// Update balance UI
function updateBalanceUI(balance) {
  const balanceEl = document.getElementById('balanceAmount');
  const statusEl = document.getElementById('walletStatus');
  
  if (balanceEl) {
    balanceEl.innerHTML = `
      <div style="font-size: 42px; font-weight: bold; color: white; margin-bottom: 5px;">
        ${balance.balance.toFixed(2)} <span style="font-size: 28px;">BOM</span>
      </div>
      <div style="color: rgba(255,255,255,0.9); font-size: 16px; margin-bottom: 10px;">$${balance.balance.toFixed(2)} USD</div>
    `;
  }
  
  // Update available balances
  document.querySelectorAll('#availableBalance, #transferBalance').forEach(el => {
    if (el) el.textContent = balance.balance.toFixed(2);
  });
  
  // Update wallet status
  if (statusEl) {
    if (balance.isFrozen) {
      statusEl.innerHTML = '<span style="color: #ff6666; font-weight: bold;">❄️ Frozen</span>';
      disableWalletActions();
      showWalletWarning('Wallet is frozen. Some actions are disabled.');
    } else {
      statusEl.innerHTML = '<span style="color: #4cff88; font-weight: bold;">✅ Active</span>';
      enableWalletActions();
      hideWalletWarning();
    }
  }
  
  // Update payment address
  const paymentAddressEl = document.getElementById('paymentAddress');
  if (paymentAddressEl) {
    paymentAddressEl.textContent = `BOTOMICS_${currentUser?.id || 'USER'}`;
  }
}

// Load subscription
async function loadSubscription() {
  try {
    const response = await fetch(`${API_BASE_URL}/subscription/status?userId=${currentUser?.id || ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch subscription');
    }
    
    const data = await response.json();
    
    if (data.success) {
      currentSubscription = data.subscription;
      updateSubscriptionUI(data);
    } else {
      throw new Error(data.error || 'Invalid subscription response');
    }
    
    return data.subscription;
    
  } catch (error) {
    console.error('Subscription load error:', error);
    // Default to freemium
    const defaultSub = {
      tier: 'freemium',
      status: 'inactive',
      autoRenew: false,
      nextBillingDate: null,
      startDate: null
    };
    currentSubscription = defaultSub;
    updateSubscriptionUI({ tier: 'freemium', subscription: defaultSub });
    return defaultSub;
  }
}

// Update subscription UI
function updateSubscriptionUI(data) {
  const tierEl = document.getElementById('currentTier');
  const infoEl = document.getElementById('subscriptionInfo');
  const actionsEl = document.getElementById('premiumActions');
  
  if (!tierEl) return;
  
  if (data.tier === 'premium') {
    tierEl.className = 'current-tier premium';
    tierEl.innerHTML = '🎉 PREMIUM SUBSCRIBER';
    
    const subscription = data.subscription;
    const nextBilling = subscription?.current_period_end ? 
      new Date(subscription.current_period_end).toLocaleDateString() : 'N/A';
    const startDate = subscription?.current_period_start ? 
      new Date(subscription.current_period_start).toLocaleDateString() : 'N/A';
    
    if (infoEl) {
      infoEl.innerHTML = `
        <div class="subscription-info">
          <p><strong>Status:</strong> Active</p>
          <p><strong>Next Billing:</strong> ${nextBilling}</p>
          <p><strong>Auto-renewal:</strong> ${subscription?.auto_renew ? 'Enabled' : 'Disabled'}</p>
          <p><strong>Monthly Cost:</strong> 3 BOM ($3.00)</p>
        </div>
      `;
    }
    
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn-primary" onclick="cancelPremium()" id="cancelPremiumBtn">
          ❌ Cancel Subscription
        </button>
        <button class="btn-secondary" onclick="toggleAutoRenew()">
          ${subscription?.auto_renew ? '🔕 Disable Auto-renew' : '🔔 Enable Auto-renew'}
        </button>
      `;
    }
  } else {
    tierEl.className = 'current-tier freemium';
    tierEl.innerHTML = '🆓 FREEMIUM USER';
    
    if (infoEl) {
      infoEl.innerHTML = `
        <div class="subscription-info">
          <p><strong>Current Plan:</strong> Free Tier</p>
          <p><strong>Features:</strong> Basic features only</p>
          <p><strong>Upgrade to unlock all features</strong></p>
        </div>
      `;
    }
    
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn-primary" onclick="upgradeToPremium('monthly')" id="upgradePremiumBtn">
          💎 Upgrade to Premium - 3 BOM/month
        </button>
        <button class="btn-secondary" onclick="upgradeToPremium('yearly')">
          🏆 Upgrade Yearly - 30 BOM/year (Save 17%)
        </button>
      `;
    }
  }
}

// Load transaction history
async function loadHistory(page = 1, filters = {}) {
  try {
    const queryParams = new URLSearchParams({
      userId: currentUser?.id || '',
      page: page,
      limit: 10,
      ...filters
    });
    
    const response = await fetch(`${API_BASE_URL}/wallet/transactions?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }
    
    const data = await response.json();
    
    if (data.success) {
      currentTransactions = data.transactions || [];
      currentPage = data.pagination?.currentPage || 1;
      totalPages = data.pagination?.totalPages || 1;
      
      displayTransactions(currentTransactions, {
        currentPage: currentPage,
        totalPages: totalPages,
        totalItems: data.pagination?.totalItems || 0
      });
    } else {
      throw new Error(data.error || 'Invalid transactions response');
    }
    
    return data;
    
  } catch (error) {
    console.error('History load error:', error);
    displayTransactions([], { currentPage: 1, totalPages: 1, totalItems: 0 });
    return { success: false, error: error.message };
  }
}

// Display transactions
function displayTransactions(transactions, pagination) {
  const container = document.getElementById('transactionsList');
  const paginationContainer = document.getElementById('pagination');
  
  if (!transactions || transactions.length === 0) {
    container.innerHTML = '<div class="loading">No transactions found</div>';
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }
  
  let html = '';
  
  transactions.forEach(transaction => {
    const date = new Date(transaction.created_at).toLocaleDateString();
    const time = new Date(transaction.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const amount = transaction.amount > 0 ? `+${transaction.amount.toFixed(2)}` : transaction.amount.toFixed(2);
    const typeEmoji = getTransactionEmoji(transaction.type);
    const statusBadge = getStatusBadge(transaction.status);
    
    html += `
    <div class="transaction-item" onclick="showTransactionDetails(${JSON.stringify(transaction).replace(/"/g, '&quot;')})">
      <div class="transaction-icon">${typeEmoji}</div>
      <div class="transaction-details">
        <div class="transaction-description">${transaction.description}</div>
        <div class="transaction-meta">
          <span class="transaction-date">${date} ${time}</span>
          <span class="transaction-status">${statusBadge}</span>
        </div>
      </div>
      <div class="transaction-amount ${transaction.amount > 0 ? 'positive' : 'negative'}">
        ${amount} ${transaction.currency || 'BOM'}
      </div>
    </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Add pagination
  if (paginationContainer && pagination.totalPages > 1) {
    let paginationHtml = '<div class="pagination">';
    
    if (currentPage > 1) {
      paginationHtml += `<button onclick="changePage(${currentPage - 1})">⬅️ Previous</button>`;
    }
    
    paginationHtml += `<span class="page-info">Page ${currentPage} of ${pagination.totalPages}</span>`;
    
    if (currentPage < pagination.totalPages) {
      paginationHtml += `<button onclick="changePage(${currentPage + 1})">Next ➡️</button>`;
    }
    
    paginationHtml += '</div>';
    paginationContainer.innerHTML = paginationHtml;
  } else if (paginationContainer) {
    paginationContainer.innerHTML = '';
  }
}

// Get transaction emoji
function getTransactionEmoji(type) {
  const emojis = {
    'deposit': '💳',
    'withdrawal': '📤',
    'transfer': '🔄',
    'subscription': '🎫',
    'admin_adjustment': '🔧',
    'fee': '💰'
  };
  return emojis[type] || '💸';
}

// Get status badge
function getStatusBadge(status) {
  const badges = {
    'pending': '<span class="status-badge pending">⏳ Pending</span>',
    'completed': '<span class="status-badge completed">✅ Completed</span>',
    'failed': '<span class="status-badge failed">❌ Failed</span>',
    'cancelled': '<span class="status-badge cancelled">🚫 Cancelled</span>'
  };
  return badges[status] || '<span class="status-badge">❓ Unknown</span>';
}

// UI Functions
function disableWalletActions() {
  const actions = ['depositBtn', 'withdrawBtn', 'transferBtn', 'submitProofBtn', 'submitDepositBtn', 
                   'submitWithdrawBtn', 'submitTransferBtn', 'copyAddressBtn'];
  actions.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }
  });
}

function enableWalletActions() {
  const actions = ['depositBtn', 'withdrawBtn', 'transferBtn', 'submitProofBtn', 'submitDepositBtn',
                   'submitWithdrawBtn', 'submitTransferBtn', 'copyAddressBtn'];
  actions.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  });
}

function showWalletWarning(message) {
  const warningDiv = document.getElementById('walletWarning');
  if (warningDiv) {
    warningDiv.innerHTML = `
      <div class="alert alert-warning">
        ⚠️ ${message}
      </div>
    `;
    warningDiv.classList.remove('hidden');
  }
}

function hideWalletWarning() {
  const warningDiv = document.getElementById('walletWarning');
  if (warningDiv) {
    warningDiv.classList.add('hidden');
  }
}

// Section Management
function hideAllSections() {
  const sections = [
    'depositSection', 'depositProofSection',
    'withdrawSection', 'withdrawRequestSection',
    'transferSection', 'historySection',
    'premiumSection', 'supportSection',
    'faqSection'
  ];
  
  sections.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.add('hidden');
    }
  });
  
  tg.BackButton.hide();
  
  // Check if we're returning to main wallet view and refresh data
  setTimeout(async () => {
    if (!isLoadingData && document.getElementById('mainContainer') && 
        !document.getElementById('mainContainer').classList.contains('hidden')) {
      await refreshAllData();
    }
  }, 500);
}

function showDeposit() {
  hideAllSections();
  document.getElementById('depositSection').classList.remove('hidden');
  tg.BackButton.show();
}

function showDepositProofForm() {
  hideAllSections();
  document.getElementById('depositProofSection').classList.remove('hidden');
  tg.BackButton.show();
}

function showWithdraw() {
  hideAllSections();
  document.getElementById('withdrawSection').classList.remove('hidden');
  tg.BackButton.show();
}

function showTransfer() {
  hideAllSections();
  document.getElementById('transferSection').classList.remove('hidden');
  tg.BackButton.show();
}

function showHistory() {
  hideAllSections();
  document.getElementById('historySection').classList.remove('hidden');
  tg.BackButton.show();
}

function showPremium() {
  hideAllSections();
  document.getElementById('premiumSection').classList.remove('hidden');
  tg.BackButton.show();
}

function showSupport() {
  hideAllSections();
  document.getElementById('supportSection').classList.remove('hidden');
  tg.BackButton.show();
}

function showFAQ() {
  hideAllSections();
  document.getElementById('faqSection').classList.remove('hidden');
  tg.BackButton.show();
}

function selectWithdrawMethod(method) {
  const methodInput = document.getElementById('withdrawMethod');
  const detailsLabel = document.getElementById('withdrawDetailsLabel');
  const detailsHint = document.getElementById('withdrawDetailsHint');
  const summaryMethod = document.getElementById('summaryMethod');
  
  if (methodInput) methodInput.value = method;
  
  switch(method) {
    case 'paypal':
      if (detailsLabel) detailsLabel.textContent = 'PayPal Email:';
      if (detailsHint) detailsHint.textContent = 'Enter the PayPal email address where you want to receive funds';
      if (summaryMethod) summaryMethod.textContent = 'PayPal';
      break;
    case 'crypto':
      if (detailsLabel) detailsLabel.textContent = 'USDT Wallet Address:';
      if (detailsHint) detailsHint.textContent = 'Enter your USDT (Tether) wallet address. We only support USDT payments.';
      if (summaryMethod) summaryMethod.textContent = 'USDT (Crypto)';
      break;
  }
  
  hideAllSections();
  document.getElementById('withdrawRequestSection').classList.remove('hidden');
  tg.BackButton.show();
}

// Action Handlers
async function submitDepositProof() {
  const amount = parseFloat(document.getElementById('depositAmount')?.value);
  const description = document.getElementById('depositDescription')?.value;
  
  if (!amount || amount < 5) {
    showAlert('Minimum deposit amount is 5 BOM ($5.00)', 'error');
    return;
  }
  
  try {
    showAlert('Submitting deposit request... Please wait.', 'info');
    
    const response = await fetch(`${API_BASE_URL}/wallet/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      },
      body: JSON.stringify({
        userId: currentUser?.id,
        amount: amount,
        description: description || `Deposit of ${amount} BOM`,
        proofImageUrl: 'https://example.com/proof.jpg', // Placeholder
        currency: 'BOM'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to submit deposit request');
    }
    
    const data = await response.json();
    
    if (data.success) {
      showAlert(`✅ Deposit request submitted! ${amount} BOM pending verification. You'll be notified when approved.`, 'success');
      hideAllSections();
      await refreshAllData();
    } else {
      throw new Error(data.error || 'Deposit request failed');
    }
    
  } catch (error) {
    console.error('Deposit error:', error);
    showAlert(`❌ Failed to submit deposit request: ${error.message}`, 'error');
  }
}

// FIXED: Submit withdrawal request with bot_id and payment_method
async function submitWithdrawalRequest() {
  const amount = parseFloat(document.getElementById('withdrawAmount')?.value);
  const method = document.getElementById('withdrawMethod')?.value;
  const details = document.getElementById('withdrawDetails')?.value.trim();
  
  if (!amount || amount < 20) {
    showAlert('Minimum withdrawal amount is 20 BOM ($20.00)', 'error');
    return;
  }
  
  if (!details) {
    showAlert('Please provide payout details', 'error');
    return;
  }
  
  if (currentBalance && amount > currentBalance.balance) {
    showAlert('Insufficient balance for withdrawal', 'error');
    return;
  }
  
  if (currentBalance?.isFrozen) {
    showAlert('Wallet is frozen. Withdrawals are disabled.', 'error');
    return;
  }
  
  // Validate details based on method
  if (method === 'paypal') {
    // Basic PayPal email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(details)) {
      showAlert('Please enter a valid PayPal email address', 'error');
      return;
    }
  } else if (method === 'crypto') {
    // Basic USDT address validation (starts with '0x' and has proper length for EVM addresses)
    if (!details.startsWith('0x') || details.length !== 42) {
      showAlert('Please enter a valid USDT wallet address (Ethereum/ERC-20 format starting with 0x)', 'error');
      return;
    }
  }
  
  try {
    console.log(`📤 Submitting withdrawal request for ${amount} BOM via ${method}`);
    console.log('Bot ID context:', currentBotId);
    
    const response = await fetch(`${API_BASE_URL}/wallet/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      },
      body: JSON.stringify({
        userId: currentUser?.id,
        botId: currentBotId || '0', // FIXED: Include bot_id
        amount: amount,
        method: method,
        paymentMethod: method, // FIXED: Include payment_method
        payoutDetails: details,
        currency: 'BOM'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to submit withdrawal');
    }
    
    const data = await response.json();
    
    if (data.success) {
      showAlert(`✅ Withdrawal request submitted! ${amount} BOM will be processed within 24 hours.`, 'success');
      hideAllSections();
      await refreshAllData();
    } else {
      throw new Error(data.error || 'Withdrawal request failed');
    }
    
  } catch (error) {
    console.error('Withdrawal error:', error);
    showAlert(`❌ ${error.message}`, 'error');
  }
}

async function submitTransfer() {
  const receiverId = document.getElementById('receiverId')?.value.trim();
  const amount = parseFloat(document.getElementById('transferAmount')?.value);
  const description = document.getElementById('transferDescription')?.value.trim();
  
  if (!receiverId) {
    showAlert('Please enter receiver ID or username', 'error');
    return;
  }
  
  if (!amount || amount <= 0) {
    showAlert('Please enter a valid amount', 'error');
    return;
  }
  
  if (amount < 0.01) {
    showAlert('Minimum transfer amount is 0.01 BOM', 'error');
    return;
  }
  
  if (currentBalance && amount > currentBalance.balance) {
    showAlert('Insufficient balance for transfer', 'error');
    return;
  }
  
  if (currentBalance?.isFrozen) {
    showAlert('Wallet is frozen. Transfers are disabled.', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/wallet/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      },
      body: JSON.stringify({
        receiverId: receiverId,
        amount: amount,
        description: description || `Transfer of ${amount} BOM`,
        currency: 'BOM'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process transfer');
    }
    
    const data = await response.json();
    
    if (data.success) {
      showAlert(`✅ Transfer successful! ${amount} BOM sent to ${receiverId}.`, 'success');
      hideAllSections();
      await refreshAllData();
    } else {
      throw new Error(data.error || 'Transfer failed');
    }
    
  } catch (error) {
    console.error('Transfer error:', error);
    showAlert(`❌ ${error.message}`, 'error');
  }
}

async function upgradeToPremium(plan) {
  const price = plan === 'yearly' ? 30 : 3;
  const period = plan === 'yearly' ? 'year' : 'month';
  
  if (currentBalance && price > currentBalance.balance) {
    showAlert(`Insufficient balance. Need ${price} BOM for Premium ${period}ly subscription.`, 'error');
    showDeposit();
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/subscription/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      },
      body: JSON.stringify({
        plan: plan
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upgrade');
    }
    
    const data = await response.json();
    
    if (data.success) {
      showAlert(`🎉 Welcome to Premium! You now have access to all premium features.`, 'success');
      await refreshAllData();
      hideAllSections();
    } else {
      throw new Error(data.error || 'Upgrade failed');
    }
    
  } catch (error) {
    console.error('Upgrade error:', error);
    showAlert(`❌ ${error.message}`, 'error');
  }
}

async function cancelPremium() {
  try {
    const response = await fetch(`${API_BASE_URL}/subscription/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to cancel subscription');
    }
    
    const data = await response.json();
    
    if (data.success) {
      showAlert('❌ Premium subscription cancelled. You will keep premium features until the end of your billing period.', 'info');
      await refreshAllData();
      hideAllSections();
    } else {
      throw new Error(data.error || 'Cancellation failed');
    }
    
  } catch (error) {
    console.error('Cancel error:', error);
    showAlert(`❌ ${error.message}`, 'error');
  }
}

async function toggleAutoRenew() {
  if (!currentSubscription) return;
  
  const newStatus = !currentSubscription.auto_renew;
  
  try {
    const response = await fetch(`${API_BASE_URL}/subscription/auto-renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': tg.initData
      },
      body: JSON.stringify({
        autoRenew: newStatus
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update auto-renewal');
    }
    
    const data = await response.json();
    
    if (data.success) {
      showAlert(`Auto-renewal ${newStatus ? 'enabled' : 'disabled'} successfully.`, 'success');
      await refreshAllData();
    } else {
      throw new Error(data.error || 'Auto-renew update failed');
    }
    
  } catch (error) {
    console.error('Auto-renew error:', error);
    showAlert('Failed to update auto-renewal', 'error');
  }
}

// Utility Functions
async function refreshData() {
  try {
    console.log('🔄 Manual refresh triggered...');
    await refreshAllData();
    showAlert('Data refreshed!', 'success');
  } catch (error) {
    console.error('Manual refresh error:', error);
    showAlert('Failed to refresh data. Please try again.', 'error');
  }
}

function copyWalletAddress() {
  const address = `BOTOMICS_${currentUser?.id || 'USER'}`;
  navigator.clipboard.writeText(address).then(() => {
    showAlert('Wallet address copied to clipboard!', 'success');
  });
}

function copyPaymentAddress() {
  const address = document.getElementById('paymentAddress')?.textContent;
  if (address) {
    navigator.clipboard.writeText(address).then(() => {
      showAlert('Payment address copied to clipboard!', 'success');
    });
  }
}

// FIXED: Support functions with correct Telegram links
function contactSupport() {
  tg.openTelegramLink('https://t.me/BotomicsSupportBot');
}

function contactForBOM() {
  tg.openTelegramLink('https://t.me/BotomicsSupportBot?text=I%20want%20to%20buy%20BOM%20coins');
}

function contactBotCreationSupport() {
  tg.openTelegramLink('https://t.me/BotomicsSupportBot?text=I%20need%20help%20with%20bot%20creation');
}

function contactWalletIssues() {
  tg.openTelegramLink('https://t.me/BotomicsSupportBot?text=I%20have%20wallet%20issues');
}

function contactPremiumSupport() {
  tg.openTelegramLink('https://t.me/BotomicsSupportBot?text=I%20need%20help%20with%20premium');
}

function showTransactionDetails(transaction) {
  const details = `
    <strong>Type:</strong> ${transaction.type}<br>
    <strong>Amount:</strong> ${transaction.amount > 0 ? '+' : ''}${transaction.amount} ${transaction.currency || 'BOM'}<br>
    <strong>Description:</strong> ${transaction.description}<br>
    <strong>Status:</strong> ${transaction.status}<br>
    <strong>Date:</strong> ${new Date(transaction.created_at).toLocaleString()}<br>
    <strong>Transaction ID:</strong> ${transaction.id}
  `;
  
  showAlert(details, 'info');
}

function changePage(page) {
  if (page < 1 || page > totalPages) return;
  
  const typeFilter = document.getElementById('historyType')?.value || 'all';
  const statusFilter = document.getElementById('historyStatus')?.value || 'all';
  
  loadHistory(page, {
    type: typeFilter !== 'all' ? typeFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined
  });
}

function showAlert(message, type = 'info') {
  tg.showPopup({
    title: type === 'error' ? 'Error' : 
           type === 'success' ? 'Success' : 
           type === 'warning' ? 'Warning' : 'Info',
    message: message,
    buttons: [{ type: 'ok' }]
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('📱 DOM loaded, checking Telegram WebApp...');
  
  // Check if running in Telegram
  if (window.Telegram?.WebApp) {
    console.log('✅ Telegram WebApp detected');
    
    // Set up error handler for unhandled rejections
    window.addEventListener('unhandledrejection', function(event) {
      console.error('Unhandled promise rejection:', event.reason);
      showAlert('An unexpected error occurred. Please refresh the page.', 'error');
    });
    
    // Initialize app
    setTimeout(() => {
      initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
        showAlert('Failed to load wallet. Please try again.', 'error');
      });
    }, 100); // Small delay to ensure DOM is ready
    
  } else {
    console.log('❌ Not in Telegram WebApp');
    document.getElementById('nonTelegramWarning')?.classList.remove('hidden');
    document.getElementById('mainContainer')?.classList.add('hidden');
    
    // For testing outside Telegram, show a warning
    showAlert('Please open this from @BotomicsBot in Telegram for full functionality.', 'warning');
    
    // Still try to initialize for testing
    setTimeout(() => {
      initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
      });
    }, 100);
  }
  
  // Initialize form event listeners
  const withdrawAmountInput = document.getElementById('withdrawAmount');
  if (withdrawAmountInput) {
    withdrawAmountInput.addEventListener('input', function() {
      const amount = parseFloat(this.value) || 0;
      const withdrawUsd = document.getElementById('withdrawUsd');
      const summaryAmount = document.getElementById('summaryAmount');
      const summaryUsd = document.getElementById('summaryUsd');
      
      if (withdrawUsd) withdrawUsd.textContent = amount.toFixed(2);
      if (summaryAmount) summaryAmount.textContent = amount;
      if (summaryUsd) summaryUsd.textContent = amount.toFixed(2);
    });
  }
  
  // FAQ toggle functionality
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(question => {
    question.addEventListener('click', function() {
      const answer = this.nextElementSibling;
      const allAnswers = document.querySelectorAll('.faq-answer');
      
      // Hide all other answers
      allAnswers.forEach(otherAnswer => {
        if (otherAnswer !== answer) {
          otherAnswer.classList.add('hidden');
        }
      });
      
      // Toggle current answer
      if (answer && answer.classList.contains('faq-answer')) {
        answer.classList.toggle('hidden');
      }
    });
  });
  
  // Add click handlers for support buttons
  const botCreationBtn = document.getElementById('supportBotCreation');
  if (botCreationBtn) {
    botCreationBtn.addEventListener('click', contactBotCreationSupport);
  }
  
  const walletIssuesBtn = document.getElementById('supportWalletIssues');
  if (walletIssuesBtn) {
    walletIssuesBtn.addEventListener('click', contactWalletIssues);
  }
  
  const premiumSupportBtn = document.getElementById('supportPremium');
  if (premiumSupportBtn) {
    premiumSupportBtn.addEventListener('click', contactPremiumSupport);
  }
  
  const buyBOMBtn = document.getElementById('supportBuyBOM');
  if (buyBOMBtn) {
    buyBOMBtn.addEventListener('click', contactForBOM);
  }
  
  // Add support contact buttons
  const contactSupportBtn = document.getElementById('contactSupport');
  if (contactSupportBtn) {
    contactSupportBtn.addEventListener('click', contactSupport);
  }
  
  const contactForBOMBtn = document.getElementById('contactForBOM');
  if (contactForBOMBtn) {
    contactForBOMBtn.addEventListener('click', contactForBOM);
  }
  
  // Initialize with refresh when wallet is opened
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const mainContainer = document.getElementById('mainContainer');
        if (mainContainer && !mainContainer.classList.contains('hidden')) {
          // Wallet is visible, refresh data
          setTimeout(async () => {
            if (!isLoadingData) {
              await refreshAllData();
            }
          }, 1000);
        }
      }
    });
  });
  
  const mainContainer = document.getElementById('mainContainer');
  if (mainContainer) {
    observer.observe(mainContainer, { attributes: true });
  }
  
  // Ensure quick actions are visible by adjusting balance card
  setTimeout(() => {
    adjustBalanceCardHeight();
  }, 500);
});

// Back button handling
tg.BackButton.onClick(() => {
  hideAllSections();
});