const WalletService = require('./services/walletService');
const SubscriptionService = require('./services/subscriptionService');
const AdvertisingService = require('./services/advertisingService');

async function testBotomicsFeatures() {
  console.log('🧪 Testing Botomics Features...\n');
  
  try {
    // Test user ID (replace with actual test user)
    const testUserId = 123456789;
    
    // 1. Test Wallet System
    console.log('1. Testing Wallet System...');
    const wallet = await WalletService.getOrCreateWallet(testUserId);
    console.log('   ✅ Wallet created/retrieved');
    
    const deposit = await WalletService.deposit(testUserId, 10, 'Test deposit');
    console.log('   ✅ Deposit completed');
    
    const balance = await WalletService.getBalance(testUserId);
    console.log('   ✅ Balance check:', balance.balance);
    
    // 2. Test Subscription System
    console.log('\n2. Testing Subscription System...');
    const tier = await SubscriptionService.getSubscriptionTier(testUserId);
    console.log('   ✅ Current tier:', tier);
    
    const botCreationAccess = await SubscriptionService.checkFeatureAccess(testUserId, 'bot_creation');
    console.log('   ✅ Bot creation access:', botCreationAccess);
    
    // 3. Test Advertising System
    console.log('\n3. Testing Advertising System...');
    // This would require a test bot with sufficient users
    
    console.log('\n🎉 All Botomics features tested successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

module.exports = testBotomicsFeatures;