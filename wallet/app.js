// wallet/app.js - Botomics Wallet Mini App
const tg = window.Telegram.WebApp;
const BACKEND_URL = 'https://testweb.maroset.com/api'; // Your backend URL

// Initialize the app
tg.expand();
tg.enableClosingConfirmation();
tg.BackButton.onClick(() => {
    hideAllSections();
    showMainDashboard();
});

// Global state
let currentUser = null;
let currentBalance = null;
let currentSubscription = null;

// Initialize app when loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // Handle hash routing
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Handle initial hash
});

function handleHashChange() {
    const hash = window.location.hash.substring(1);
    
    hideAllSections();
    
    switch(hash) {
        case 'deposit':
            showDeposit();
            break;
        case 'withdraw':
            showWithdraw();
            break;
        case 'transfer':
            showTransfer();
            break;
        case 'history':
            showHistory();
            break;
        case 'premium':
            showPremium();
            break;
        case 'support':
            showSupport();
            break;
        case 'buy':
            showBuyBOM();
            break;
        default:
            showMainDashboard();
            break;
    }
}

async function initializeApp() {
    try {
        // Show user info
        showUserInfo();
        
        // Load initial data
        await loadBalance();
        await loadSubscription();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize app');
    }
}

function showUserInfo() {
    const user = tg.initDataUnsafe?.user;
    if (user) {
        currentUser = user;
        document.getElementById('userInfo').innerHTML = `
            ${user.first_name}${user.username ? ` (@${user.username})` : ''}
        `;
        document.getElementById('userId').textContent = `ID: ${user.id}`;
    } else {
        document.getElementById('userInfo').textContent = 'User not available';
    }
}

async function loadBalance() {
    try {
        document.getElementById('balanceAmount').innerHTML = '<div class="loading">Loading balance...</div>';
        
        // Call backend API
        const response = await fetch(`${BACKEND_URL}/wallet/balance`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch balance');
        }
        
        const data = await response.json();
        
        currentBalance = data;
        
        document.getElementById('balanceAmount').innerHTML = `
            <div class="balance-main">${data.balance.toFixed(2)} <span class="currency">${data.currency}</span></div>
            <div class="balance-usd">$${data.balance.toFixed(2)} USD</div>
        `;
        
        const statusElement = document.getElementById('walletStatus');
        if (data.isFrozen) {
            statusElement.innerHTML = `
                <span style="color: #e74c3c; font-weight: bold;">❄️ Frozen</span>
                ${data.freezeReason ? `<br><small style="color: #e74c3c;">Reason: ${data.freezeReason}</small>` : ''}
            `;
            // Disable actions if wallet is frozen
            disableWalletActions();
        } else {
            statusElement.innerHTML = '<span style="color: #2ecc71; font-weight: bold;">✅ Active</span>';
            enableWalletActions();
        }
        
    } catch (error) {
        console.error('Balance load error:', error);
        document.getElementById('balanceAmount').innerHTML = '<div style="color: #e74c3c;">Error loading balance</div>';
    }
}

function disableWalletActions() {
    const actions = ['depositBtn', 'withdrawBtn', 'transferBtn', 'upgradePremiumBtn'];
    actions.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    });
    
    // Show warning
    document.getElementById('walletWarning').innerHTML = `
        <div class="alert alert-warning">
            ⚠️ Wallet is frozen. Some actions are disabled.
        </div>
    `;
}

function enableWalletActions() {
    const actions = ['depositBtn', 'withdrawBtn', 'transferBtn', 'upgradePremiumBtn'];
    actions.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
    
    // Clear warning
    document.getElementById('walletWarning').innerHTML = '';
}

async function loadSubscription() {
    try {
        // Call backend API
        const response = await fetch(`${BACKEND_URL}/subscription/status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch subscription');
        }
        
        const data = await response.json();
        
        currentSubscription = data;
        
        const tierElement = document.getElementById('currentTier');
        const actionsElement = document.getElementById('premiumActions');
        
        if (data.tier === 'premium') {
            tierElement.className = 'current-tier premium';
            tierElement.innerHTML = '🎉 PREMIUM SUBSCRIBER';
            const nextBilling = data.nextBillingDate ? new Date(data.nextBillingDate).toLocaleDateString() : 'N/A';
            actionsElement.innerHTML = `
                <div class="subscription-info">
                    <p><strong>Next billing:</strong> ${nextBilling}</p>
                    <p><strong>Auto-renewal:</strong> ${data.autoRenew ? 'Enabled' : 'Disabled'}</p>
                    <p><strong>Monthly cost:</strong> 5 BOM ($5.00)</p>
                </div>
                <button class="btn-primary" onclick="cancelPremium()" id="cancelPremiumBtn">
                    ❌ Cancel Subscription
                </button>
            `;
        } else {
            tierElement.className = 'current-tier freemium';
            tierElement.innerHTML = '🆓 FREEMIUM USER';
            actionsElement.innerHTML = `
                <button class="btn-primary" onclick="upgradeToPremium()" id="upgradePremiumBtn">
                    💎 Upgrade to Premium - 5 BOM/month
                </button>
            `;
        }
        
    } catch (error) {
        console.error('Subscription load error:', error);
        document.getElementById('currentTier').innerHTML = 'Error loading subscription';
    }
}

// Section management
function hideAllSections() {
    const sections = [
        'mainDashboard',
        'depositSection',
        'withdrawSection',
        'transferSection',
        'historySection',
        'premiumSection',
        'supportSection',
        'buyBomSection',
        'depositProofSection',
        'withdrawRequestSection'
    ];
    
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

function showMainDashboard() {
    hideAllSections();
    document.getElementById('mainDashboard').style.display = 'block';
    tg.BackButton.hide();
    window.location.hash = '';
}

function showDeposit() {
    hideAllSections();
    document.getElementById('depositSection').style.display = 'block';
    tg.BackButton.show();
}

function showWithdraw() {
    hideAllSections();
    document.getElementById('withdrawSection').style.display = 'block';
    tg.BackButton.show();
}

function showTransfer() {
    hideAllSections();
    document.getElementById('transferSection').style.display = 'block';
    tg.BackButton.show();
}

function showHistory() {
    hideAllSections();
    document.getElementById('historySection').style.display = 'block';
    tg.BackButton.show();
    loadHistory(0);
}

function showPremium() {
    hideAllSections();
    document.getElementById('premiumSection').style.display = 'block';
    tg.BackButton.show();
}

function showSupport() {
    hideAllSections();
    document.getElementById('supportSection').style.display = 'block';
    tg.BackButton.show();
}

function showBuyBOM() {
    hideAllSections();
    document.getElementById('buyBomSection').style.display = 'block';
    tg.BackButton.show();
}

function showDepositProofForm() {
    hideAllSections();
    document.getElementById('depositProofSection').style.display = 'block';
    tg.BackButton.show();
}

function showWithdrawRequestForm(method) {
    hideAllSections();
    document.getElementById('withdrawRequestSection').style.display = 'block';
    document.getElementById('withdrawMethod').value = method;
    tg.BackButton.show();
}

// Navigation functions
function navigateTo(section) {
    window.location.hash = section;
}

// Transaction History
async function loadHistory(page = 0) {
    try {
        document.getElementById('transactionsList').innerHTML = '<div class="loading">Loading transactions...</div>';
        
        const response = await fetch(`${BACKEND_URL}/wallet/transactions?page=${page}&limit=10`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch transactions');
        }
        
        const data = await response.json();
        displayTransactions(data.transactions, data.pagination);
        
    } catch (error) {
        console.error('History load error:', error);
        document.getElementById('transactionsList').innerHTML = '<div style="color: #e74c3c;">Error loading history</div>';
    }
}

function displayTransactions(transactions, pagination) {
    const container = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="loading">No transactions found</div>';
        return;
    }
    
    let html = '';
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.created_at).toLocaleDateString();
        const time = new Date(transaction.created_at).toLocaleTimeString();
        const amount = transaction.amount > 0 ? `+${transaction.amount.toFixed(2)}` : transaction.amount.toFixed(2);
        const typeEmoji = getTransactionEmoji(transaction.type);
        const statusBadge = getStatusBadge(transaction.status);
        
        html += `
        <div class="transaction-item">
            <div class="transaction-icon">${typeEmoji}</div>
            <div class="transaction-details">
                <div class="transaction-description">${transaction.description}</div>
                <div class="transaction-meta">
                    <span class="transaction-date">${date} ${time}</span>
                    <span class="transaction-status">${statusBadge}</span>
                </div>
            </div>
            <div class="transaction-amount ${transaction.amount > 0 ? 'positive' : 'negative'}">
                ${amount} ${transaction.currency}
            </div>
        </div>
        `;
    });
    
    // Add pagination controls
    if (pagination.totalPages > 1) {
        html += `<div class="pagination-controls">`;
        
        if (pagination.currentPage > 1) {
            html += `<button class="btn-small" onclick="loadHistory(${pagination.currentPage - 2})">⬅️ Previous</button>`;
        }
        
        html += `<span class="page-info">Page ${pagination.currentPage} of ${pagination.totalPages}</span>`;
        
        if (pagination.currentPage < pagination.totalPages) {
            html += `<button class="btn-small" onclick="loadHistory(${pagination.currentPage})">Next ➡️</button>`;
        }
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

function getTransactionEmoji(type) {
    const emojis = {
        'deposit': '💳',
        'withdrawal': '📤',
        'transfer': '🔄',
        'subscription': '🎫',
        'donation': '☕',
        'ad_revenue': '📢',
        'reward': '🎁',
        'admin_adjustment': '🔧'
    };
    return emojis[type] || '💸';
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="status-badge pending">⏳ Pending</span>',
        'completed': '<span class="status-badge completed">✅ Completed</span>',
        'failed': '<span class="status-badge failed">❌ Failed</span>',
        'cancelled': '<span class="status-badge cancelled">🚫 Cancelled</span>'
    };
    return badges[status] || '';
}

// Action handlers
async function submitDepositProof() {
    const amount = document.getElementById('depositAmount').value;
    const description = document.getElementById('depositDescription').value;
    const proofFile = document.getElementById('depositProof').files[0];
    
    if (!amount || amount < 5) {
        showAlert('Minimum deposit amount is 5 BOM ($5.00)');
        return;
    }
    
    if (!proofFile) {
        showAlert('Please upload proof of payment');
        return;
    }
    
    try {
        showAlert('Uploading proof... Please wait.', 'info');
        
        // Upload proof image
        const formData = new FormData();
        formData.append('proof', proofFile);
        
        const uploadResponse = await fetch(`${BACKEND_URL}/upload/proof`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tg.initData}`
            },
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload proof');
        }
        
        const uploadData = await uploadResponse.json();
        
        // Submit deposit request
        const depositResponse = await fetch(`${BACKEND_URL}/wallet/deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            },
            body: JSON.stringify({
                amount: parseFloat(amount),
                description: description || `Deposit of ${amount} BOM`,
                proofImageUrl: uploadData.url
            })
        });
        
        if (!depositResponse.ok) {
            throw new Error('Failed to submit deposit request');
        }
        
        const depositData = await depositResponse.json();
        
        showAlert(`✅ Deposit request submitted! ${amount} BOM pending verification.`, 'success');
        showMainDashboard();
        loadBalance();
        
    } catch (error) {
        console.error('Deposit error:', error);
        showAlert('❌ Failed to submit deposit request: ' + error.message);
    }
}

async function submitWithdrawalRequest() {
    const amount = document.getElementById('withdrawAmount').value;
    const method = document.getElementById('withdrawMethod').value;
    const details = document.getElementById('withdrawDetails').value;
    
    if (!amount || amount < 20) {
        showAlert('Minimum withdrawal amount is 20 BOM ($20.00)');
        return;
    }
    
    if (!details) {
        showAlert('Please provide payout details');
        return;
    }
    
    if (currentBalance && amount > currentBalance.balance) {
        showAlert('Insufficient balance for withdrawal');
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/wallet/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            },
            body: JSON.stringify({
                amount: parseFloat(amount),
                method: method,
                payoutDetails: details
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to submit withdrawal');
        }
        
        const data = await response.json();
        
        showAlert(`✅ Withdrawal request submitted! ${amount} BOM will be processed within 24 hours.`, 'success');
        showMainDashboard();
        loadBalance();
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        showAlert(`❌ ${error.message}`);
    }
}

async function submitTransfer() {
    const receiverId = document.getElementById('receiverId').value;
    const amount = document.getElementById('transferAmount').value;
    const description = document.getElementById('transferDescription').value;
    
    if (!receiverId) {
        showAlert('Please enter receiver ID or username');
        return;
    }
    
    if (!amount || amount <= 0) {
        showAlert('Please enter a valid amount');
        return;
    }
    
    if (currentBalance && amount > currentBalance.balance) {
        showAlert('Insufficient balance for transfer');
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/wallet/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            },
            body: JSON.stringify({
                receiverId: receiverId,
                amount: parseFloat(amount),
                description: description || `Transfer of ${amount} BOM`
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to process transfer');
        }
        
        const data = await response.json();
        
        showAlert(`✅ Transfer successful! ${amount} BOM sent.`, 'success');
        showMainDashboard();
        loadBalance();
        
    } catch (error) {
        console.error('Transfer error:', error);
        showAlert(`❌ ${error.message}`);
    }
}

async function upgradeToPremium() {
    if (currentBalance && currentBalance.balance < 5) {
        showAlert('Insufficient balance. Need 5 BOM for Premium subscription.');
        navigateTo('deposit');
        return;
    }
    
    if (!confirm('Upgrade to Premium for 5 BOM per month? This will auto-renew monthly until cancelled.')) {
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/subscription/upgrade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to upgrade');
        }
        
        const data = await response.json();
        
        showAlert(`🎉 Welcome to Premium! You now have access to all premium features.`, 'success');
        
        loadSubscription();
        loadBalance();
        showMainDashboard();
        
    } catch (error) {
        console.error('Upgrade error:', error);
        showAlert(`❌ ${error.message}`);
    }
}

async function cancelPremium() {
    if (!confirm('Cancel your Premium subscription? You will keep premium features until the end of your billing period.')) {
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/subscription/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to cancel subscription');
        }
        
        const data = await response.json();
        
        showAlert('❌ Premium subscription cancelled. You will keep premium features until the end of your billing period.', 'info');
        
        loadSubscription();
        showMainDashboard();
        
    } catch (error) {
        console.error('Cancel error:', error);
        showAlert(`❌ ${error.message}`);
    }
}

function contactSupport() {
    tg.openTelegramLink('https://t.me/BotomicsSupportBot');
}

function contactForBOM() {
    tg.openTelegramLink('https://t.me/BotomicsSupportBot');
}

function openMainBot() {
    tg.openTelegramLink('https://t.me/BotomicsBot');
}

// Utility functions
function showError(message) {
    showAlert(message, 'error');
}

function showAlert(message, type = 'info') {
    tg.showPopup({
        title: type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info',
        message: message,
        buttons: [{ type: 'ok' }]
    });
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

// Close app when back button is pressed and no sections are open
document.addEventListener('backbutton', function() {
    if (!isAnySectionOpen()) {
        tg.close();
    }
});

function isAnySectionOpen() {
    return [
        'depositSection',
        'withdrawSection',
        'transferSection',
        'historySection',
        'premiumSection',
        'supportSection',
        'buyBomSection',
        'depositProofSection',
        'withdrawRequestSection'
    ].some(id => {
        const element = document.getElementById(id);
        return element && element.style.display === 'block';
    });
}

// Quick actions
function copyWalletAddress() {
    const address = `BOTOMICS_${currentUser?.id || 'USER'}`;
    navigator.clipboard.writeText(address).then(() => {
        showAlert('Wallet address copied to clipboard!', 'success');
    });
}

function refreshData() {
    loadBalance();
    loadSubscription();
    showAlert('Data refreshed!', 'success');
}

function sendTelegramData(action) {
    const data = {
        action: action,
        userId: currentUser?.id,
        timestamp: Date.now()
    };
    
    tg.sendData(JSON.stringify(data));
}

// Initialize app when Telegram Web App is ready
tg.ready();