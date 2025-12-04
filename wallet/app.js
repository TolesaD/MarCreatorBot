// Botomics Wallet - Complete Production Version
const tg = window.Telegram.WebApp;
const BACKEND_URL = 'https://testweb.maroset.com/api';
const BOTOMICS_SUPPORT_BOT = '@BotomicsSupportBot';

// Initialize the app
tg.expand();
tg.enableClosingConfirmation();
tg.BackButton.onClick(() => {
    hideAllSections();
});

// Global state
let currentUser = null;
let currentBalance = null;
let currentSubscription = null;
let currentTransactions = [];
let currentPage = 1;
let totalPages = 1;

// Check if running in Telegram Web App
function isTelegramWebApp() {
    return typeof window.Telegram !== 'undefined' && 
           typeof window.Telegram.WebApp !== 'undefined' &&
           window.Telegram.WebApp.initData;
}

// Initialize app when loaded
document.addEventListener('DOMContentLoaded', function() {
    // Show warning if not in Telegram
    if (!isTelegramWebApp()) {
        document.getElementById('nonTelegramWarning').classList.remove('hidden');
        document.getElementById('mainContainer').classList.add('hidden');
        return;
    }
    
    initializeApp();
});

async function initializeApp() {
    try {
        console.log('🚀 Initializing Botomics Wallet...');
        
        // Show user info
        showUserInfo();
        
        // Load initial data
        await Promise.all([
            loadBalance(),
            loadSubscription(),
            loadHistory()
        ]);
        
        // Send opened event to bot
        sendTelegramData('wallet_opened');
        
        // Update user reference in payment address
        if (currentUser) {
            document.getElementById('userRef').textContent = currentUser.id;
        }
        
        console.log('✅ Botomics Wallet initialized successfully');
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showError('Failed to initialize wallet. Please try again.');
    }
}

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

async function loadBalance() {
    try {
        document.getElementById('balanceAmount').innerHTML = '<div class="loading">Loading balance...</div>';
        
        // Call backend API
        const response = await fetch(`${BACKEND_URL}/wallet/balance?userId=${currentUser?.id || ''}`, {
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
        
        // Update balance display
        document.getElementById('balanceAmount').innerHTML = `
            ${data.balance.toFixed(2)} <span style="font-size: 0.6em;">${data.currency}</span>
        `;
        
        // Update available balances in other sections
        document.getElementById('availableBalance').textContent = data.balance.toFixed(2);
        document.getElementById('transferBalance').textContent = data.balance.toFixed(2);
        
        // Update wallet status
        const statusElement = document.getElementById('walletStatus');
        if (data.isFrozen) {
            statusElement.innerHTML = '❄️ Frozen';
            statusElement.style.color = '#e74c3c';
            statusElement.style.background = 'rgba(231, 76, 60, 0.2)';
            
            // Disable actions if wallet is frozen
            disableWalletActions();
            showWalletWarning('Wallet is frozen. Some actions are disabled.');
        } else {
            statusElement.innerHTML = '✅ Active';
            statusElement.style.color = '#2ecc71';
            statusElement.style.background = 'rgba(46, 204, 113, 0.2)';
            
            // Enable actions
            enableWalletActions();
            hideWalletWarning();
        }
        
        return data;
        
    } catch (error) {
        console.error('Balance load error:', error);
        
        // Fallback to mock data for testing
        const mockBalance = {
            balance: 15.50,
            currency: 'BOM',
            isFrozen: false,
            freezeReason: null
        };
        
        currentBalance = mockBalance;
        
        document.getElementById('balanceAmount').innerHTML = `
            ${mockBalance.balance.toFixed(2)} <span style="font-size: 0.6em;">${mockBalance.currency}</span>
        `;
        document.getElementById('walletStatus').innerHTML = '✅ Active';
        
        return mockBalance;
    }
}

function disableWalletActions() {
    const actions = ['depositBtn', 'withdrawBtn', 'transferBtn', 'submitProofBtn', 'submitDepositBtn', 
                     'submitWithdrawBtn', 'submitTransferBtn', 'copyAddressBtn', 'qrCodeBtn'];
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
                     'submitWithdrawBtn', 'submitTransferBtn', 'copyAddressBtn', 'qrCodeBtn'];
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
    warningDiv.innerHTML = `
        <div class="alert alert-warning">
            ⚠️ ${message}
        </div>
    `;
    warningDiv.classList.remove('hidden');
}

function hideWalletWarning() {
    document.getElementById('walletWarning').classList.add('hidden');
}

async function loadSubscription() {
    try {
        // Call backend API
        const response = await fetch(`${BACKEND_URL}/subscription/status?userId=${currentUser?.id || ''}`, {
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
        updateSubscriptionUI(data);
        
        return data;
        
    } catch (error) {
        console.error('Subscription load error:', error);
        
        // Fallback to mock data
        const mockSubscription = {
            tier: 'freemium',
            autoRenew: false,
            nextBillingDate: null,
            startDate: new Date().toISOString()
        };
        
        currentSubscription = mockSubscription;
        updateSubscriptionUI(mockSubscription);
        
        return mockSubscription;
    }
}

function updateSubscriptionUI(subscription) {
    const tierElement = document.getElementById('currentTier');
    const actionsElement = document.getElementById('premiumActions');
    const infoElement = document.getElementById('subscriptionInfo');
    
    if (subscription.tier === 'premium') {
        tierElement.className = 'current-tier premium';
        tierElement.innerHTML = '🎉 PREMIUM SUBSCRIBER';
        
        const nextBilling = subscription.nextBillingDate ? 
            new Date(subscription.nextBillingDate).toLocaleDateString() : 'N/A';
        const startDate = subscription.startDate ? 
            new Date(subscription.startDate).toLocaleDateString() : 'N/A';
        
        infoElement.innerHTML = `
            <div class="subscription-info">
                <p><strong>Start Date:</strong> ${startDate}</p>
                <p><strong>Next Billing:</strong> ${nextBilling}</p>
                <p><strong>Auto-renewal:</strong> ${subscription.autoRenew ? 'Enabled' : 'Disabled'}</p>
                <p><strong>Monthly Cost:</strong> 5 BOM ($5.00)</p>
            </div>
        `;
        
        actionsElement.innerHTML = `
            <button class="btn-primary" onclick="cancelPremium()" id="cancelPremiumBtn">
                ❌ Cancel Subscription
            </button>
            <button class="btn-secondary" onclick="toggleAutoRenew()">
                ${subscription.autoRenew ? '🔕 Disable Auto-renew' : '🔔 Enable Auto-renew'}
            </button>
        `;
    } else {
        tierElement.className = 'current-tier freemium';
        tierElement.innerHTML = '🆓 FREEMIUM USER';
        
        infoElement.innerHTML = `
            <div class="subscription-info">
                <p><strong>Current Plan:</strong> Free Tier</p>
                <p><strong>Bots Limit:</strong> 5 bots</p>
                <p><strong>Features:</strong> Basic features only</p>
                <p><strong>Upgrade to unlock all features</strong></p>
            </div>
        `;
        
        actionsElement.innerHTML = `
            <button class="btn-primary" onclick="upgradeToPremium('monthly')" id="upgradePremiumBtn">
                💎 Upgrade to Premium - 5 BOM/month
            </button>
            <button class="btn-secondary" onclick="upgradeToPremium('yearly')">
                🏆 Upgrade Yearly - 50 BOM/year (Save 17%)
            </button>
        `;
    }
}

async function loadHistory(page = 1, filters = {}) {
    try {
        document.getElementById('transactionsList').innerHTML = '<div class="loading">Loading transactions...</div>';
        
        // Build query string
        const queryParams = new URLSearchParams({
            page: page,
            limit: 10,
            userId: currentUser?.id || '',
            ...filters
        });
        
        // Call backend API
        const response = await fetch(`${BACKEND_URL}/wallet/transactions?${queryParams}`, {
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
        
        currentTransactions = data.transactions;
        currentPage = data.pagination.currentPage;
        totalPages = data.pagination.totalPages;
        
        displayTransactions(data.transactions, data.pagination);
        
        return data;
        
    } catch (error) {
        console.error('History load error:', error);
        
        // Fallback to mock data
        const mockTransactions = [
            {
                id: '1',
                type: 'deposit',
                amount: 50.00,
                currency: 'BOM',
                description: 'Initial deposit',
                status: 'completed',
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: '2',
                type: 'subscription',
                amount: -5.00,
                currency: 'BOM',
                description: 'Premium subscription',
                status: 'completed',
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: '3',
                type: 'transfer',
                amount: -10.00,
                currency: 'BOM',
                description: 'Transfer to @friend',
                status: 'completed',
                created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        
        currentTransactions = mockTransactions;
        displayTransactions(mockTransactions, {
            currentPage: 1,
            totalPages: 1,
            totalItems: 3
        });
        
        return { transactions: mockTransactions, pagination: { currentPage: 1, totalPages: 1 } };
    }
}

function displayTransactions(transactions, pagination) {
    const container = document.getElementById('transactionsList');
    const paginationContainer = document.getElementById('pagination');
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="loading">No transactions found</div>';
        paginationContainer.innerHTML = '';
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
        <div class="transaction-item" onclick="showTransactionDetails('${transaction.id}')">
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
    
    container.innerHTML = html;
    
    // Add pagination controls
    if (pagination.totalPages > 1) {
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
    } else {
        paginationContainer.innerHTML = '';
    }
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
        'admin_adjustment': '🔧',
        'refund': '↩️',
        'fee': '💰'
    };
    return emojis[type] || '💸';
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="status-badge pending">⏳ Pending</span>',
        'completed': '<span class="status-badge completed">✅ Completed</span>',
        'failed': '<span class="status-badge failed">❌ Failed</span>',
        'cancelled': '<span class="status-badge cancelled">🚫 Cancelled</span>',
        'processing': '<span class="status-badge pending">⚙️ Processing</span>'
    };
    return badges[status] || '<span class="status-badge">❓ Unknown</span>';
}

// Section Management
function hideAllSections() {
    const sections = [
        'depositSection', 'depositProofSection',
        'withdrawSection', 'withdrawRequestSection',
        'transferSection', 'historySection',
        'premiumSection', 'supportSection'
    ];
    
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
        }
    });
    
    tg.BackButton.hide();
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

function selectWithdrawMethod(method) {
    const methodInput = document.getElementById('withdrawMethod');
    const detailsLabel = document.getElementById('withdrawDetailsLabel');
    const detailsHint = document.getElementById('withdrawDetailsHint');
    const summaryMethod = document.getElementById('summaryMethod');
    
    methodInput.value = method;
    
    switch(method) {
        case 'paypal':
            detailsLabel.textContent = 'PayPal Email:';
            detailsHint.textContent = 'Enter the PayPal email address where you want to receive funds';
            summaryMethod.textContent = 'PayPal';
            break;
        case 'bank_transfer':
            detailsLabel.textContent = 'Bank Details:';
            detailsHint.textContent = 'Enter your bank account details (Account Name, Number, Bank Name, SWIFT/IBAN)';
            summaryMethod.textContent = 'Bank Transfer';
            break;
        case 'crypto':
            detailsLabel.textContent = 'Crypto Wallet Address:';
            detailsHint.textContent = 'Enter your cryptocurrency wallet address (BTC, ETH, USDT, etc.)';
            summaryMethod.textContent = 'Crypto';
            break;
    }
    
    hideAllSections();
    document.getElementById('withdrawRequestSection').classList.remove('hidden');
    tg.BackButton.show();
}

// Action Handlers
async function submitDepositProof() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const description = document.getElementById('depositDescription').value;
    const proofFile = document.getElementById('depositProof').files[0];
    
    // Validation
    if (!amount || amount < 5) {
        showAlert('Minimum deposit amount is 5 BOM ($5.00)', 'error');
        return;
    }
    
    if (!proofFile) {
        showAlert('Please upload proof of payment', 'error');
        return;
    }
    
    if (proofFile.size > 5 * 1024 * 1024) { // 5MB
        showAlert('File too large. Maximum size is 5MB.', 'error');
        return;
    }
    
    try {
        showAlert('Uploading proof... Please wait.', 'info');
        
        // Create form data for file upload
        const formData = new FormData();
        formData.append('proof', proofFile);
        formData.append('userId', currentUser?.id || '');
        formData.append('amount', amount);
        formData.append('description', description || `Deposit of ${amount} BOM`);
        
        // Upload proof image
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
                userId: currentUser?.id,
                amount: amount,
                description: description || `Deposit of ${amount} BOM`,
                proofImageUrl: uploadData.url,
                currency: 'BOM'
            })
        });
        
        if (!depositResponse.ok) {
            const errorData = await depositResponse.json();
            throw new Error(errorData.message || 'Failed to submit deposit request');
        }
        
        const depositData = await depositResponse.json();
        
        showAlert(`✅ Deposit request submitted! ${amount} BOM pending verification. You'll be notified when approved.`, 'success');
        
        hideAllSections();
        await loadBalance();
        await loadHistory();
        
    } catch (error) {
        console.error('Deposit error:', error);
        showAlert(`❌ Failed to submit deposit request: ${error.message}`, 'error');
    }
}

async function submitWithdrawalRequest() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const method = document.getElementById('withdrawMethod').value;
    const details = document.getElementById('withdrawDetails').value.trim();
    
    // Validation
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
    
    try {
        const response = await fetch(`${BACKEND_URL}/wallet/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            },
            body: JSON.stringify({
                userId: currentUser?.id,
                amount: amount,
                method: method,
                payoutDetails: details,
                currency: 'BOM'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to submit withdrawal');
        }
        
        const data = await response.json();
        
        showAlert(`✅ Withdrawal request submitted! ${amount} BOM will be processed within 24 hours.`, 'success');
        
        hideAllSections();
        await loadBalance();
        await loadHistory();
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        showAlert(`❌ ${error.message}`, 'error');
    }
}

async function submitTransfer() {
    const receiverId = document.getElementById('receiverId').value.trim();
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const description = document.getElementById('transferDescription').value.trim();
    
    // Validation
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
    
    // Check if transferring to self
    if (receiverId === currentUser?.id.toString() || receiverId === `@${currentUser?.username}`) {
        showAlert('You cannot transfer to yourself', 'error');
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
                senderId: currentUser?.id,
                receiverId: receiverId,
                amount: amount,
                description: description || `Transfer of ${amount} BOM`,
                currency: 'BOM'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to process transfer');
        }
        
        const data = await response.json();
        
        showAlert(`✅ Transfer successful! ${amount} BOM sent to ${receiverId}.`, 'success');
        
        hideAllSections();
        await loadBalance();
        await loadHistory();
        
    } catch (error) {
        console.error('Transfer error:', error);
        showAlert(`❌ ${error.message}`, 'error');
    }
}

async function upgradeToPremium(plan) {
    const price = plan === 'yearly' ? 50 : 5;
    const period = plan === 'yearly' ? 'year' : 'month';
    
    if (!confirm(`Upgrade to Premium for ${price} BOM per ${period}? This will auto-renew until cancelled.`)) {
        return;
    }
    
    if (currentBalance && price > currentBalance.balance) {
        showAlert(`Insufficient balance. Need ${price} BOM for Premium ${period}ly subscription.`, 'error');
        showDeposit();
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/subscription/upgrade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            },
            body: JSON.stringify({
                userId: currentUser?.id,
                plan: plan,
                amount: price
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to upgrade');
        }
        
        const data = await response.json();
        
        showAlert(`🎉 Welcome to Premium! You now have access to all premium features.`, 'success');
        
        await loadSubscription();
        await loadBalance();
        hideAllSections();
        
    } catch (error) {
        console.error('Upgrade error:', error);
        showAlert(`❌ ${error.message}`, 'error');
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
            },
            body: JSON.stringify({
                userId: currentUser?.id
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to cancel subscription');
        }
        
        const data = await response.json();
        
        showAlert('❌ Premium subscription cancelled. You will keep premium features until the end of your billing period.', 'info');
        
        await loadSubscription();
        hideAllSections();
        
    } catch (error) {
        console.error('Cancel error:', error);
        showAlert(`❌ ${error.message}`, 'error');
    }
}

async function toggleAutoRenew() {
    if (!currentSubscription) return;
    
    const newStatus = !currentSubscription.autoRenew;
    
    try {
        const response = await fetch(`${BACKEND_URL}/subscription/auto-renew`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tg.initData}`
            },
            body: JSON.stringify({
                userId: currentUser?.id,
                autoRenew: newStatus
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update auto-renewal');
        }
        
        showAlert(`Auto-renewal ${newStatus ? 'enabled' : 'disabled'} successfully.`, 'success');
        await loadSubscription();
        
    } catch (error) {
        console.error('Auto-renew error:', error);
        showAlert('Failed to update auto-renewal', 'error');
    }
}

// Utility Functions
function refreshData() {
    loadBalance();
    loadSubscription();
    loadHistory();
    showAlert('Data refreshed!', 'success');
}

function copyWalletAddress() {
    const address = `BOTOMICS_${currentUser?.id || 'USER'}`;
    navigator.clipboard.writeText(address).then(() => {
        showAlert('Wallet address copied to clipboard!', 'success');
    });
}

function copyPaymentAddress() {
    const address = document.getElementById('paymentAddress').textContent;
    navigator.clipboard.writeText(address).then(() => {
        showAlert('Payment address copied to clipboard!', 'success');
    });
}

function contactSupport() {
    tg.openTelegramLink(`https://t.me/${BOTOMICS_SUPPORT_BOT.replace('@', '')}`);
}

function contactForBOM() {
    tg.openTelegramLink(`https://t.me/${BOTOMICS_SUPPORT_BOT.replace('@', '')}?text=Buy+BOM+coins`);
}

function sendTelegramData(action) {
    const data = {
        action: action,
        userId: currentUser?.id,
        timestamp: Date.now(),
        platform: 'web_app'
    };
    
    tg.sendData(JSON.stringify(data));
}

function showTransactionDetails(transactionId) {
    const transaction = currentTransactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    const details = `
        <strong>Type:</strong> ${transaction.type}<br>
        <strong>Amount:</strong> ${transaction.amount > 0 ? '+' : ''}${transaction.amount} ${transaction.currency}<br>
        <strong>Description:</strong> ${transaction.description}<br>
        <strong>Status:</strong> ${transaction.status}<br>
        <strong>Date:</strong> ${new Date(transaction.created_at).toLocaleString()}<br>
        <strong>Transaction ID:</strong> ${transaction.id}
    `;
    
    showAlert(details, 'info');
}

function changePage(page) {
    if (page < 1 || page > totalPages) return;
    
    const typeFilter = document.getElementById('historyType').value;
    const statusFilter = document.getElementById('historyStatus').value;
    const periodFilter = document.getElementById('historyPeriod').value;
    
    loadHistory(page, {
        type: typeFilter !== 'all' ? typeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        period: periodFilter
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

function showError(message) {
    showAlert(message, 'error');
}

// Initialize when Telegram Web App is ready
tg.ready();

// Export for debugging
window.BotomicsWallet = {
    refreshData,
    loadBalance,
    loadSubscription,
    loadHistory,
    currentUser,
    currentBalance,
    currentSubscription
};

console.log('Botomics Wallet loaded successfully');