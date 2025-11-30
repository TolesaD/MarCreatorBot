const { Markup } = require('telegraf');
const WalletService = require('./services/walletService');
const SubscriptionService = require('./services/subscriptionService');

class WalletHandler {
// Add to MetaBotCreator class

async showWallet(ctx) {
  try {
    const userId = ctx.from.id;
    const wallet = await WalletService.getBalance(userId);
    
    const message = `💰 *Your Botomics Wallet*\n\n` +
      `*Balance:* ${wallet.balance} ${wallet.currency}\n` +
      `*Status:* ${wallet.isFrozen ? '❄️ Frozen' : '✅ Active'}\n\n` +
      `*1 ${wallet.currency} = $1.00 USD*\n\n` +
      `*Available Actions:*`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💳 Deposit BOM', 'wallet_deposit')],
      [Markup.button.callback('📤 Withdraw BOM', 'wallet_withdraw')],
      [Markup.button.callback('🔄 Transaction History', 'wallet_history')],
      [Markup.button.callback('🎫 Subscribe Premium', 'subscribe_premium')],
      [Markup.button.callback('🔙 Main Menu', 'start')]
    ]);
    
    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.replyWithMarkdown(message, keyboard);
    }
    
    if (ctx.updateType === 'callback_query') {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    console.error('Wallet show error:', error);
    await ctx.reply('❌ Error loading wallet.');
  }
}

async showDepositInstructions(ctx) {
  try {
    const message = `💳 *Deposit BOM Coins*\n\n` +
      `To add BOM coins to your wallet:\n\n` +
      `1. *Rate:* 1 BOM = $1.00 USD\n` +
      `2. Send payment to our platform address\n` +
      `3. Submit transaction proof for verification\n` +
      `4. Coins will be added after verification\n\n` +
      `*Minimum Deposit:* $5 (5 BOM)\n` +
      `*Processing Time:* 1-6 hours\n\n` +
      `💡 *Contact @BotomicsSupport for payment details*`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📸 Submit Proof', 'submit_deposit_proof')],
      [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Deposit instructions error:', error);
    await ctx.reply('❌ Error showing deposit instructions.');
  }
}

async showWithdrawalInstructions(ctx) {
  try {
    const userId = ctx.from.id;
    const wallet = await WalletService.getBalance(userId);
    
    const message = `📤 *Withdraw BOM Coins*\n\n` +
      `*Current Balance:* ${wallet.balance} BOM\n` +
      `*Minimum Withdrawal:* 20 BOM ($20.00)\n\n` +
      `*Withdrawal Process:*\n` +
      `1. Enter amount (minimum 20 BOM)\n` +
      `2. Provide payment details\n` +
      `3. Submit withdrawal request\n` +
      `4. Processed within 24 hours\n\n` +
      `*Available Methods:* PayPal, Bank Transfer, Crypto`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💰 Request Withdrawal', 'start_withdrawal')],
      [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Withdrawal instructions error:', error);
    await ctx.reply('❌ Error showing withdrawal instructions.');
  }
}

async showPremium(ctx) {
  try {
    const userId = ctx.from.id;
    const currentTier = await SubscriptionService.getSubscriptionTier(userId);
    const wallet = await WalletService.getBalance(userId);
    
    const message = `🎫 *Premium Subscription*\n\n` +
      `*Current Tier:* ${currentTier === 'premium' ? '🎉 PREMIUM' : '🆓 FREEMIUM'}\n` +
      `*Wallet Balance:* ${wallet.balance} BOM\n\n` +
      `*Premium Benefits:*\n` +
      `✅ Unlimited bot creation\n` +
      `✅ Unlimited broadcasts\n` +
      `✅ Unlimited co-admins\n` +
      `✅ Unlimited force-join channels\n` +
      `✅ Enable donation system\n` +
      `✅ Pin /start message\n` +
      `✅ Ad-free experience\n` +
      `✅ Priority support\n\n` +
      `*Price:* 5 BOM per month ($5.00)\n` +
      `*Auto-renewal:* Enabled by default`;
    
    const keyboardButtons = [];
    
    if (currentTier === 'freemium') {
      if (wallet.balance >= 5) {
        keyboardButtons.push([Markup.button.callback('⭐ Upgrade to Premium', 'upgrade_premium')]);
      } else {
        keyboardButtons.push([Markup.button.callback('💳 Add BOM Coins', 'wallet_deposit')]);
      }
    } else {
      keyboardButtons.push([Markup.button.callback('✅ Premium Active', 'wallet_main')]);
    }
    
    keyboardButtons.push([Markup.button.callback('🔙 Main Menu', 'start')]);
    
    const keyboard = Markup.inlineKeyboard(keyboardButtons);
    
    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.replyWithMarkdown(message, keyboard);
    }
    
    if (ctx.updateType === 'callback_query') {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    console.error('Premium subscription error:', error);
    await ctx.reply('❌ Error loading subscription info.');
  }
}

async upgradeToPremium(ctx) {
  try {
    const userId = ctx.from.id;
    
    await ctx.answerCbQuery('🔄 Processing upgrade...');
    
    await SubscriptionService.upgradeToPremium(userId);
    
    await ctx.editMessageText(
      `🎉 *Welcome to Premium!*\n\n` +
      `Your subscription has been activated successfully!\n\n` +
      `You now have access to all premium features:\n` +
      `• Unlimited bots & broadcasts\n` +
      `• Advanced bot management\n` +
      `• Ad-free experience\n` +
      `• And much more!\n\n` +
      `*Next billing date:* ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
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
  static async handleUpgradePremium(ctx) {
    try {
      const userId = ctx.from.id;
      
      await ctx.answerCbQuery('🔄 Processing upgrade...');
      
      await SubscriptionService.upgradeToPremium(userId);
      
      await ctx.editMessageText(
        `🎉 *Welcome to Premium!*\n\n` +
        `Your subscription has been activated successfully!\n\n` +
        `You now have access to all premium features:\n` +
        `• Unlimited bots & broadcasts\n` +
        `• Advanced bot management\n` +
        `• Ad-free experience\n` +
        `• And much more!\n\n` +
        `*Next billing date:* ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
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
}

// Session management for wallet operations
const walletSessions = new Map();

module.exports = {
  WalletHandler,
  walletSessions
};