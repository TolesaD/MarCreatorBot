const SubscriptionService = require('./subscriptionService');
const cron = require('node-cron');

class SubscriptionCron {
  start() {
    // Run daily at 00:00 UTC
    cron.schedule('0 0 * * *', async () => {
      console.log('🔄 Running daily subscription renewals...');
      try {
        const results = await SubscriptionService.processAutoRenewals();
        console.log('✅ Subscription renewals completed:', results);
      } catch (error) {
        console.error('❌ Subscription renewal error:', error);
      }
    });
    
    // Run every hour to check expiring subscriptions
    cron.schedule('0 * * * *', async () => {
      console.log('🔄 Checking expiring subscriptions...');
      try {
        // Check subscriptions expiring in next 24 hours
        // Send reminders to users with low balance
        // You can implement this later
      } catch (error) {
        console.error('❌ Subscription check error:', error);
      }
    });
    
    console.log('⏰ Subscription cron jobs started');
  }
}

module.exports = new SubscriptionCron();