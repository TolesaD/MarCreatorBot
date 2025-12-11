// src/handlers/walletHandler.js - USER WALLET ONLY
const { Markup } = require('telegraf');
const WalletService = require('../services/walletService');
const SubscriptionService = require('../services/subscriptionService');
const PlatformAdminHandler = require('./platformAdminHandler');

class WalletHandler {
  async handleWalletCommand(ctx) {
    try {
      const userId = ctx.from.id;
      const wallet = await WalletService.getBalance(userId);
      
      const message = `💰 *Your Botomics Wallet*\n\n` +
        `*Balance:* ${wallet.balance.toFixed(2)} ${wallet.currency}\n` +
        `*Status:* ${wallet.isFrozen ? '❄️ Frozen' : '✅ Active'}\n` +
        `${wallet.freezeReason ? `*Reason:* ${wallet.freezeReason}\n` : ''}` +
        `*1 BOM = $1.00 USD*\n\n` +
        `*Available Actions:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💳 Deposit BOM', 'wallet_deposit')],
        [Markup.button.callback('📤 Withdraw BOM', 'wallet_withdraw')],
        [Markup.button.callback('🔄 Transfer BOM', 'wallet_transfer')],
        [Markup.button.callback('📊 Transaction History', 'wallet_history')],
        [Markup.button.callback('🎫 Premium Subscription', 'wallet_premium')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
    } catch (error) {
      console.error('Wallet command error:', error);
      await ctx.reply('❌ Error loading wallet. Please try again.');
    }
  }
  
  async handleDeposit(ctx) {
    try {
      const message = `💳 *Deposit BOM Coins*\n\n` +
        `*How to deposit:*\n` +
        `1. Contact @BotomicsSupportBot to buy BOM\n` +
        `2. Follow payment instructions\n` +
        `3. Send payment proof\n` +
        `4. Wait for admin verification (1-6 hours)\n\n` +
        `*Payment Details:*\n` +
        `▫️ Rate: 1 BOM = $1.00 USD\n` +
        `▫️ Minimum: 5 BOM ($5.00)\n` +
        `▫️ Your Wallet Address: \`BOTOMICS_${ctx.from.id}\`\n\n` +
        `*Important:*\n` +
        `• Always include your Telegram ID in payment notes\n` +
        `• Contact @BotomicsSupportBot for any issues`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('📞 Contact Support', 'https://t.me/BotomicsSupportBot')],
        [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Deposit handler error:', error);
      await ctx.answerCbQuery('❌ Error showing deposit instructions');
    }
  }
  
  async handleWithdraw(ctx) {
    try {
      const userId = ctx.from.id;
      const wallet = await WalletService.getBalance(userId);
      
      const message = `📤 *Withdraw BOM Coins*\n\n` +
        `*Current Balance:* ${wallet.balance.toFixed(2)} BOM\n` +
        `*Minimum Withdrawal:* 20 BOM ($20.00)\n` +
        `*Processing Time:* 24 hours\n\n` +
        `*Available Methods:*\n` +
        `▫️ PayPal (Email required)\n` +
        `▫️ Crypto (Wallet address required)\n\n` +
        `*Note:*\n` +
        `• Withdrawals are processed manually\n` +
        `• Use wallet Mini-App to submit withdrawal request\n` +
        `• Contact support for urgent requests`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('📞 Contact Support', 'https://t.me/BotomicsSupportBot')],
        [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Withdraw handler error:', error);
      await ctx.answerCbQuery('❌ Error showing withdrawal instructions');
    }
  }
  
  async handleTransfer(ctx) {
    try {
      const userId = ctx.from.id;
      const wallet = await WalletService.getBalance(userId);
      
      const message = `🔄 *Transfer BOM Coins*\n\n` +
        `*Current Balance:* ${wallet.balance.toFixed(2)} BOM\n` +
        `*Transfer Fee:* 1% (Freemium), 0.5% (Premium)\n` +
        `*Minimum Transfer:* 0.01 BOM\n\n` +
        `*How to transfer:*\n` +
        `1. Use wallet Mini-App\n` +
        `2. Enter receiver's Telegram ID, @username, or BOTOMICS_address\n` +
        `3. Enter amount to transfer\n` +
        `4. Confirm transfer\n\n` +
        `*Note:*\n` +
        `• Transfers are instant\n` +
        `• Cannot be reversed\n` +
        `• Both users must have active wallets`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Transfer handler error:', error);
      await ctx.answerCbQuery('❌ Error showing transfer instructions');
    }
  }
  
  async handlePremium(ctx) {
    try {
      const userId = ctx.from.id;
      const currentTier = await SubscriptionService.getSubscriptionTier(userId);
      const wallet = await WalletService.getBalance(userId);
      
      const message = `🎫 *Premium Subscription*\n\n` +
        `*Current Tier:* ${currentTier === 'premium' ? '🎉 PREMIUM' : '🆓 FREEMIUM'}\n` +
        `*Wallet Balance:* ${wallet.balance.toFixed(2)} BOM\n\n` +
        `*Premium Benefits:*\n` +
        `✅ Unlimited bot creation\n` +
        `✅ Unlimited broadcasts\n` +
        `✅ Unlimited co-admins\n` +
        `✅ Unlimited force-join channels\n` +
        `✅ Enable donation system\n` +
        `✅ Pin /start message\n` +
        `✅ Ad-free experience\n` +
        `✅ Priority support\n\n` +
        `*Price:* 3 BOM per month ($3.00)\n` +
        `*Auto-renewal:* Enabled by default`;
      
      const keyboardButtons = [];
      
      if (currentTier === 'freemium') {
        if (wallet.balance >= 3 && !wallet.isFrozen) {
          keyboardButtons.push([Markup.button.callback('⭐ Upgrade to Premium', 'wallet_upgrade_premium')]);
        } else {
          keyboardButtons.push([Markup.button.callback('💳 Add BOM Coins', 'wallet_deposit')]);
        }
      } else {
        const subscription = await SubscriptionService.getUserSubscription(userId);
        const nextBilling = subscription ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A';
        keyboardButtons.push([Markup.button.callback('✅ Premium Active', 'wallet_main')]);
        keyboardButtons.push([Markup.button.callback(`🔄 Next billing: ${nextBilling}`, 'noop')]);
        keyboardButtons.push([Markup.button.callback('❌ Cancel Subscription', 'wallet_cancel_premium')]);
      }
      
      keyboardButtons.push([Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]);
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Premium handler error:', error);
      await ctx.answerCbQuery('❌ Error loading subscription info');
    }
  }
  
  async handleHistory(ctx, page = 0) {
    try {
      const userId = ctx.from.id;
      const history = await WalletService.getTransactionHistory(userId, 10, page * 10);
      
      let message = `📊 *Transaction History* - Page ${page + 1}\n\n`;
      
      if (history.transactions.length === 0) {
        message += `No transactions found.\n\n`;
      } else {
        history.transactions.forEach((tx, index) => {
          const date = new Date(tx.created_at).toLocaleDateString();
          const time = new Date(tx.created_at).toLocaleTimeString();
          const amount = tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2);
          const statusEmoji = {
            'pending': '⏳',
            'completed': '✅',
            'failed': '❌',
            'cancelled': '🚫'
          }[tx.status] || '💸';
          
          message += `${statusEmoji} *${date} ${time}*\n`;
          message += `   ${tx.description}\n`;
          message += `   Amount: ${amount} ${tx.currency}\n`;
          message += `   Status: ${tx.status}\n\n`;
        });
      }
      
      message += `*Total Transactions:* ${history.pagination.total}`;
      
      const keyboardButtons = [];
      
      if (page > 0) {
        keyboardButtons.push(Markup.button.callback('⬅️ Previous', `wallet_history_${page - 1}`));
      }
      
      if (history.pagination.hasMore) {
        keyboardButtons.push(Markup.button.callback('Next ➡️', `wallet_history_${page + 1}`));
      }
      
      keyboardButtons.push(Markup.button.callback('🔙 Back to Wallet', 'wallet_main'));
      
      const keyboard = Markup.inlineKeyboard([keyboardButtons]);
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('History handler error:', error);
      await ctx.answerCbQuery('❌ Error loading transaction history');
    }
  }
  
  async handleUpgradePremium(ctx) {
    try {
      const userId = ctx.from.id;
      
      await ctx.answerCbQuery('🔄 Processing upgrade...');
      
      await SubscriptionService.upgradeToPremium(userId);
      
      await ctx.editMessageText(
        `🎉 *Welcome to Premium!*\n\n` +
        `Your subscription has been activated successfully!\n\n` +
        `*You now have access to:*\n` +
        `• Unlimited bots & broadcasts\n` +
        `• Advanced bot management\n` +
        `• Ad-free experience\n` +
        `• Priority support\n` +
        `• And much more!\n\n` +
        `*Next billing date:* ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}\n` +
        `*Manage subscription:* /premium\n\n` +
        `Thank you for upgrading! 🚀`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
          ])
        }
      );
    } catch (error) {
      console.error('Upgrade premium error:', error);
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }
  
  async handleCancelPremium(ctx) {
    try {
      const userId = ctx.from.id;
      
      await ctx.answerCbQuery('🔄 Cancelling subscription...');
      
      await SubscriptionService.cancelSubscription(userId);
      
      await ctx.editMessageText(
        `❌ *Premium Subscription Cancelled*\n\n` +
        `Your premium subscription has been cancelled.\n\n` +
        `*Note:* You will keep premium features until the end of your current billing period.\n\n` +
        `You can upgrade again anytime from your wallet.\n\n` +
        `Thank you for being a premium subscriber!`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
          ])
        }
      );
    } catch (error) {
      console.error('Cancel premium error:', error);
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }
}

module.exports = new WalletHandler();