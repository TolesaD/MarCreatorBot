// Telegram Web App initialization
let tg = window.Telegram.WebApp;

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

// Initialize app when loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

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
    } else {
        document.getElementById('userInfo').textContent = 'User not available';
    }
}

async function loadBalance() {
    try {
        document.getElementById('balanceAmount').innerHTML = '<div class="loading">Loading balance...</div>';
        
        // In a real app, you'd call your backend API
        // For now, we'll simulate API call
        setTimeout(() => {
            // Simulated balance data
            const balanceData = {
                balance: 15.50,
                currency: 'BOM',
                isFrozen: false
            };
            
            currentBalance = balanceData;
            
            document.getElementById('balanceAmount').innerHTML = `
                <div>${balanceData.balance} ${balanceData.currency}</div>
            `;
            
            document.getElementById('walletStatus').innerHTML = `
                Status: ${balanceData.isFrozen ? '❄️ Frozen' : '✅ Active'}
            `;
            
        }, 1000);
        
    } catch (error) {
        console.error('Balance load error:', error);
        document.getElementById('balanceAmount').innerHTML = '<div style="color: #e74c3c;">Error loading balance</div>';
    }
}

async function loadSubscription() {
    try {
        // Simulated subscription data
        const subscriptionData = {
            tier: 'freemium', // or 'premium'
            status: 'active'
        };
        
        currentSubscription = subscriptionData;
        
        const tierElement = document.getElementById('currentTier');
        const actionsElement = document.getElementById('premiumActions');
        
        if (subscriptionData.tier === 'premium') {
            tierElement.className = 'current-tier premium';
            tierElement.innerHTML = '🎉 PREMIUM SUBSCRIBER';
            actionsElement.innerHTML = `
                <button class="btn-primary" onclick="cancelPremium()">
                    ❌ Cancel Subscription
                </button>
            `;
        } else {
            tierElement.className = 'current-tier freemium';
            tierElement.innerHTML = '🆓 FREEMIUM USER';
            actionsElement.innerHTML = `
                <button class="btn-primary" onclick="upgradeToPremium()">
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
    document.getElementById('depositSection').style.display = 'none';
    document.getElementById('withdrawSection').style.display = 'none';
    document.getElementById('historySection').style.display = 'none';
    document.getElementById('premiumSection').style.display = 'none';
    tg.BackButton.hide();
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

// Transaction History
async function loadHistory(page = 0) {
    try {
        document.getElementById('transactionsList').innerHTML = '<div class="loading">Loading transactions...</div>';
        
        // Simulated transaction data
        setTimeout(() => {
            const transactions = [
                {
                    id: 1,
                    type: 'deposit',
                    amount: 10.00,
                    description: 'BOM Purchase',
                    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    currency: 'BOM'
                },
                {
                    id: 2,
                    type: 'withdrawal',
                    amount: -5.00,
                    description: 'Premium Subscription',
                    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    currency: 'BOM'
                },
                {
                    id: 3,
                    type: 'transfer',
                    amount: 2.50,
                    description: 'Donation from User',
                    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                    currency: 'BOM'
                }
            ];
            
            displayTransactions(transactions);
        }, 1000);
        
    } catch (error) {
        console.error('History load error:', error);
        document.getElementById('transactionsList').innerHTML = '<div style="color: #e74c3c;">Error loading history</div>';
    }
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="loading">No transactions found</div>';
        return;
    }
    
    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-details">
                <div class="transaction-description">${transaction.description}</div>
                <div class="transaction-date">${transaction.date.toLocaleDateString()}</div>
            </div>
            <div class="transaction-amount ${transaction.amount > 0 ? 'positive' : 'negative'}">
                ${transaction.amount > 0 ? '+' : ''}${transaction.amount} ${transaction.currency}
            </div>
        </div>
    `).join('');
}

// Action handlers
function contactSupport() {
    tg.openTelegramLink('https://t.me/BotomicsSupport');
}

function submitWithdrawal() {
    const amount = document.getElementById('withdrawAmount').value;
    
    if (!amount || amount < 20) {
        alert('Minimum withdrawal amount is 20 BOM');
        return;
    }
    
    if (currentBalance && amount > currentBalance.balance) {
        alert('Insufficient balance for withdrawal');
        return;
    }
    
    // In real app, call backend API
    alert(`Withdrawal request for ${amount} BOM submitted! Processing time: 24 hours.`);
    hideAllSections();
}

function upgradeToPremium() {
    if (confirm('Upgrade to Premium for 5 BOM per month?')) {
        // In real app, call backend API
        tg.showPopup({
            title: 'Premium Upgrade',
            message: 'Redirecting to upgrade...',
            buttons: [{ type: 'ok' }]
        });
        
        // Simulate upgrade
        setTimeout(() => {
            loadSubscription();
            loadBalance();
            hideAllSections();
        }, 2000);
    }
}

function cancelPremium() {
    if (confirm('Cancel your Premium subscription?')) {
        // In real app, call backend API
        tg.showPopup({
            title: 'Subscription Cancelled',
            message: 'Your premium subscription has been cancelled. You will keep premium features until the end of your billing period.',
            buttons: [{ type: 'ok' }]
        });
        
        // Simulate cancellation
        setTimeout(() => {
            loadSubscription();
            hideAllSections();
        }, 2000);
    }
}

// Utility functions
function showError(message) {
    tg.showPopup({
        title: 'Error',
        message: message,
        buttons: [{ type: 'ok' }]
    });
}

// Close app when back button is pressed and no sections are open
document.addEventListener('backbutton', function() {
    if (!isAnySectionOpen()) {
        tg.close();
    }
});

function isAnySectionOpen() {
    return document.getElementById('depositSection').style.display === 'block' ||
           document.getElementById('withdrawSection').style.display === 'block' ||
           document.getElementById('historySection').style.display === 'block' ||
           document.getElementById('premiumSection').style.display === 'block';
}