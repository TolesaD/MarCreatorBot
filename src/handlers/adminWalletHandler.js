const { Markup } = require('telegraf');
const WalletService = require('../services/walletService');
const PlatformAdminHandler = require('./platformAdminHandler');

class AdminWalletHandler {
  async handleAddBOMCommand(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }
      
      const args = ctx.message.text.split(' ');
      if (args.length < 4) {
        await ctx.reply(
          '📝 Usage: /add_bom <user_id_or_@username> <amount> <reason>\n' +
          'Example: /add_bom @john 50 "Payment received for BOM purchase"'
        );
        return;
      }
      
      const userIdentifier = args[1].replace('@', '');
      const amount = parseFloat(args[2]);
      const reason = args.slice(3).join(' ');
      
      if (!amount || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Must be positive number.');
        return;
      }
      
      // First, let admin confirm
      await ctx.reply(
        `🔍 *Confirm BOM Addition*\n\n` +
        `*User:* ${userIdentifier}\n` +
        `*Amount:* ${amount} BOM ($${amount.toFixed(2)})\n` +
        `*Reason:* ${reason}\n\n` +
        `*Rate:* 1 BOM = $1.00 USD\n\n` +
        `Proceed with this transaction?`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Yes, Add BOM', `admin_confirm_add_bom_${userIdentifier}_${amount}`)],
            [Markup.button.callback('❌ Cancel', 'admin_wallet_dashboard')]
          ])
        }
      );
    } catch (error) {
      console.error('Add BOM command error:', error);
      await ctx.reply('❌ Error processing command.');
    }
  }
  
  async handleConfirmAddBOM(ctx, userIdentifier, amount) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      
      await ctx.answerCbQuery('🔄 Adding BOM...');
      
      // Get user ID from identifier (could be username or ID)
      let userId;
      if (isNaN(userIdentifier)) {
        // It's a username
        const { User } = require('../models');
        const user = await User.findOne({ 
          where: { username: userIdentifier } 
        });
        
        if (!user) {
          await ctx.editMessageText('❌ User not found. Make sure they have used the bot before.');
          return;
        }
        userId = user.telegram_id;
      } else {
        userId = parseInt(userIdentifier);
      }
      
      // Add BOM to wallet
      const result = await WalletService.adminAdjustBalance(
        userId, 
        amount, 
        'Manual BOM sale by admin', 
        ctx.from.id
      );
      
      await ctx.editMessageText(
        `✅ *BOM Added Successfully!*\n\n` +
        `*User ID:* ${userId}\n` +
        `*Amount Added:* ${amount} BOM ($${amount.toFixed(2)})\n` +
        `*New Balance:* ${result.newBalance.toFixed(2)} BOM\n` +
        `*Transaction ID:* ${result.transaction.id}\n\n` +
        `User has been notified of the deposit.`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 View Wallet', `admin_view_wallet_${userId}`)],
            [Markup.button.callback('🏦 Admin Dashboard', 'admin_wallet_dashboard')]
          ])
        }
      );
      
      // Notify the user
      try {
        const bot = ctx.telegram;
        await bot.sendMessage(
          userId,
          `💰 *BOM Deposit Confirmed!*\n\n` +
          `✅ Your wallet has been credited with ${amount} BOM ($${amount.toFixed(2)}).\n\n` +
          `*New Balance:* ${result.newBalance.toFixed(2)} BOM\n` +
          `*Transaction:* Manual BOM purchase\n\n` +
          `Check your wallet: /wallet`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }
    } catch (error) {
      console.error('Confirm add BOM error:', error);
      await ctx.editMessageText(`❌ Error: ${error.message}`);
    }
  }
  
  async handleProcessWithdrawal(ctx, withdrawalId, action) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      
      await ctx.answerCbQuery('🔄 Processing...');
      
      let message;
      if (action === 'approve') {
        await WalletService.processWithdrawal(withdrawalId, ctx.from.id, 'approve', 'Approved via admin panel');
        message = '✅ Withdrawal approved and marked as processing.';
      } else if (action === 'reject') {
        await WalletService.processWithdrawal(withdrawalId, ctx.from.id, 'reject', 'Rejected via admin panel');
        message = '❌ Withdrawal rejected. Funds returned to wallet.';
      } else if (action === 'complete') {
        await WalletService.processWithdrawal(withdrawalId, ctx.from.id, 'complete', 'Completed via admin panel');
        message = '🎉 Withdrawal marked as completed.';
      }
      
      await ctx.editMessageText(message);
    } catch (error) {
      console.error('Process withdrawal error:', error);
      await ctx.answerCbQuery(`❌ Error: ${error.message}`);
    }
  }
  
  async handleFreezeWallet(ctx, userId, reason) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      
      await ctx.answerCbQuery('❄️ Freezing wallet...');
      
      await WalletService.freezeWallet(userId, reason, ctx.from.id);
      
      await ctx.editMessageText(
        `❄️ *Wallet Frozen*\n\n` +
        `User ID: ${userId}\n` +
        `Reason: ${reason}\n\n` +
        `Wallet is now frozen and cannot perform transactions.`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔓 Unfreeze', `admin_unfreeze_wallet_${userId}`)],
            [Markup.button.callback('🏦 Dashboard', 'admin_wallet_dashboard')]
          ])
        }
      );
    } catch (error) {
      console.error('Freeze wallet error:', error);
      await ctx.answerCbQuery(`❌ Error: ${error.message}`);
    }
  }
}

module.exports = new AdminWalletHandler();