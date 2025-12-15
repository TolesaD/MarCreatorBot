// src/handlers/platformAdminHandler.js - COMPLETE FIXED VERSION
const { Markup } = require('telegraf');
const { User, Bot, UserLog, Feedback, BroadcastHistory, Admin, Wallet, Withdrawal, UserSubscription } = require('../models');
const { formatNumber } = require('../utils/helpers');
const MiniBotManager = require('../services/MiniBotManager');
const WalletService = require('../services/walletService');
const SubscriptionService = require('../services/subscriptionService');

// Store admin management sessions
const platformAdminSessions = new Map();

class PlatformAdminHandler {
  
  // Check if user is platform creator
  static isPlatformCreator(userId) {
    return userId === 1827785384 || userId === 6911189278;
  }

  // Enhanced Markdown escaping for platform-scale data
  static escapeMarkdown(text) {
    if (!text) return '';
    
    // Escape all Markdown special characters
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  // Safe answerCbQuery wrapper with timeout handling
  static async safeAnswerCbQuery(ctx) {
    if (ctx.updateType === 'callback_query') {
      try {
        await ctx.answerCbQuery();
      } catch (error) {
        // Ignore timeout errors
        if (!error.response?.description?.includes('query is too old')) {
          console.error('Answer callback query error:', error.message);
        }
      }
    }
  }

  // Platform admin dashboard
  static async platformDashboard(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Platform admin access required.');
        return;
      }

      // Get comprehensive platform statistics
      const [
        totalUsers,
        totalBotOwners,
        totalBots,
        activeBots,
        totalMessages,
        pendingMessages,
        totalBroadcasts,
        todayUsers
      ] = await Promise.all([
        User.count(),
        User.count({ 
          include: [{
            model: Bot,
            as: 'OwnedBots',
            required: true
          }]
        }),
        Bot.count(),
        Bot.count({ where: { is_active: true } }),
        Feedback.count(),
        Feedback.count({ where: { is_replied: false } }),
        BroadcastHistory.count(),
        User.count({
          where: {
            last_active: {
              [require('sequelize').Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      // Get wallet stats separately to handle errors
      let walletStats = {
        totalWallets: 0,
        frozenWallets: 0,
        totalBalance: 0,
        netRevenue: 0
      };
      
      try {
        walletStats = await WalletService.getWalletStats();
      } catch (error) {
        console.log('⚠️ Could not load wallet stats:', error.message);
      }

      const dashboardMessage = `👑 *Platform Admin Dashboard*\n\n` +
        `📊 *Platform Statistics:*\n` +
        `👥 Total Users: ${formatNumber(totalUsers)}\n` +
        `👥 Active Today: ${formatNumber(todayUsers)}\n` +
        `🤖 Bot Owners: ${formatNumber(totalBotOwners)}\n` +
        `🤖 Total Bots: ${formatNumber(totalBots)}\n` +
        `🟢 Active Bots: ${formatNumber(activeBots)}\n` +
        `💬 Total Messages: ${formatNumber(totalMessages)}\n` +
        `📨 Pending Messages: ${formatNumber(pendingMessages)}\n` +
        `📢 Total Broadcasts: ${formatNumber(totalBroadcasts)}\n\n` +
        `💰 *Wallet Statistics:*\n` +
        `🏦 Total Wallets: ${formatNumber(walletStats.totalWallets)}\n` +
        `❄️ Frozen Wallets: ${formatNumber(walletStats.frozenWallets)}\n` +
        `💰 Total BOM: ${walletStats.totalBalance.toFixed(2)}\n` +
        `📈 Net Revenue: ${walletStats.netRevenue.toFixed(2)} BOM\n\n` +
        `*Admin Actions:*`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👥 User Management', 'platform_users')],
        [Markup.button.callback('🤖 Bot Management', 'platform_bots')],
        [Markup.button.callback('💰 Wallet Admin', 'platform_wallet_admin')],
        [Markup.button.callback('🎫 Subscription Admin', 'platform_subscription_admin')],
        [Markup.button.callback('📢 Platform Broadcast', 'platform_broadcast')],
        [Markup.button.callback('🚫 Ban Management', 'platform_bans')],
        [Markup.button.callback('📊 Advanced Analytics', 'platform_analytics')],
        [Markup.button.callback('🔄 Refresh Stats', 'platform_dashboard_refresh')]
      ]);

      if (ctx.updateType === 'callback_query') {
        try {
          await ctx.editMessageText(dashboardMessage, {
            parse_mode: 'Markdown',
            ...keyboard
          });
          await this.safeAnswerCbQuery(ctx);
        } catch (error) {
          // If message content is the same, just answer callback query
          if (error.response && error.response.error_code === 400 && 
              error.response.description.includes('message is not modified')) {
            await this.safeAnswerCbQuery(ctx);
            return;
          }
          // If edit fails, send new message
          await ctx.replyWithMarkdown(dashboardMessage, keyboard);
        }
      } else {
        await ctx.replyWithMarkdown(dashboardMessage, keyboard);
      }

    } catch (error) {
      console.error('Platform dashboard error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading platform dashboard.');
    }
  }

  // ==================== WALLET ADMIN METHODS ====================

  static async walletAdminDashboard(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }
      
      let stats = {
        totalWallets: 0,
        activeWallets: 0,
        frozenWallets: 0,
        totalBalance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        netRevenue: 0
      };
      
      try {
        stats = await WalletService.getWalletStats();
      } catch (error) {
        console.log('⚠️ Could not load wallet stats:', error.message);
      }
      
      const message = `🏦 *Wallet System Admin*\n\n` +
        `*Platform Statistics:*\n` +
        `▫️ Total Wallets: ${stats.totalWallets}\n` +
        `▫️ Active Wallets: ${stats.activeWallets}\n` +
        `▫️ Frozen Wallets: ${stats.frozenWallets}\n` +
        `▫️ Total Balance: ${stats.totalBalance.toFixed(2)} BOM\n` +
        `▫️ Total Deposits: ${stats.totalDeposits.toFixed(2)} BOM\n` +
        `▫️ Total Withdrawals: ${stats.totalWithdrawals.toFixed(2)} BOM\n` +
        `▫️ Net Revenue: ${stats.netRevenue.toFixed(2)} BOM\n\n` +
        `*Quick Actions:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📥 Pending Deposits', 'platform_pending_deposits')],
        [Markup.button.callback('📤 Pending Withdrawals', 'platform_pending_withdrawals')],
        [Markup.button.callback('💰 Add BOM to User', 'platform_add_bom')],
        [Markup.button.callback('❄️ Freeze Wallet', 'platform_freeze_wallet')],
        [Markup.button.callback('✅ Unfreeze Wallet', 'platform_unfreeze_wallet')],
        [Markup.button.callback('📊 Wallet Report', 'platform_wallet_report')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Wallet admin dashboard error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading wallet dashboard.');
    }
  }

  static async showPendingDeposits(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      let deposits = [];
      try {
        deposits = await WalletService.getPendingDeposits();
      } catch (error) {
        console.error('Get pending deposits error:', error.message);
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('⚠️ Could not load pending deposits');
        return;
      }
      
      if (deposits.length === 0) {
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Back to Wallet Admin', 'platform_wallet_admin')]
        ]);
        
        await ctx.editMessageText(
          `📥 *No Pending Deposits*\n\n` +
          'There are no pending deposit requests at the moment.\n' +
          `*Updated:* ${new Date().toLocaleTimeString()}`,
          { parse_mode: 'Markdown', ...keyboard }
        );
        return;
      }

      let message = `📥 *Pending Deposits* (${deposits.length})\n\n`;
      
      deposits.forEach((deposit, index) => {
        const date = new Date(deposit.created_at).toLocaleString();
        const user = deposit.wallet?.user || {};
        const userName = user.username ? `@${user.username}` : (user.first_name || `User ${user.telegram_id}`);
        const userId = user.telegram_id || 'Unknown';
        
        message += `*${index + 1}. Deposit Request*\n`;
        message += `   User: ${userName} (ID: ${userId})\n`;
        message += `   Amount: ${parseFloat(deposit.amount).toFixed(2)} BOM\n`;
        message += `   Description: ${deposit.description || 'No description'}\n`;
        message += `   Date: ${date}\n`;
        message += `   ID: ${deposit.id}\n`;
        message += `   [Approve](/approve_deposit_${deposit.id}) | [Reject](/reject_deposit_${deposit.id})\n\n`;
      });

      // Add timestamp to make message unique
      message += `\n*Updated:* ${new Date().toLocaleTimeString()}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'platform_pending_deposits')],
        [Markup.button.callback('🔙 Back to Wallet Admin', 'platform_wallet_admin')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Show pending deposits error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading pending deposits');
    }
  }

  static async showPendingWithdrawals(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      let withdrawals = [];
      try {
        withdrawals = await WalletService.getPendingWithdrawals();
      } catch (error) {
        console.error('Get pending withdrawals error:', error.message);
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('⚠️ Could not load pending withdrawals');
        return;
      }
      
      if (withdrawals.length === 0) {
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Back to Wallet Admin', 'platform_wallet_admin')]
        ]);
        
        await ctx.editMessageText(
          `📤 *No Pending Withdrawals*\n\n` +
          'There are no pending withdrawal requests at the moment.\n' +
          `*Updated:* ${new Date().toLocaleTimeString()}`,
          { parse_mode: 'Markdown', ...keyboard }
        );
        return;
      }

      let message = `📤 *Pending Withdrawals* (${withdrawals.length})\n\n`;
      
      withdrawals.forEach((withdrawal, index) => {
        const user = withdrawal.User || {};
        const userName = user.username ? `@${user.username}` : (user.first_name || 'Unknown');
        const method = withdrawal.method || 'Unknown';
        const details = withdrawal.payout_details || 'No details';
        const date = new Date(withdrawal.created_at).toLocaleString();
        
        message += `*${index + 1}. Withdrawal Request*\n`;
        message += `   User: ${userName} (ID: ${withdrawal.user_id})\n`;
        message += `   Amount: ${parseFloat(withdrawal.amount).toFixed(2)} BOM ($${parseFloat(withdrawal.usd_value || withdrawal.amount).toFixed(2)})\n`;
        message += `   Method: ${method}\n`;
        message += `   Details: ${details}\n`;
        message += `   Date: ${date}\n`;
        message += `   ID: ${withdrawal.id}\n`;
        message += `   [Approve](/approve_withdrawal_${withdrawal.id}) | [Reject](/reject_withdrawal_${withdrawal.id}) | [Complete](/complete_withdrawal_${withdrawal.id})\n\n`;
      });

      // Add timestamp to make message unique
      message += `\n*Updated:* ${new Date().toLocaleTimeString()}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'platform_pending_withdrawals')],
        [Markup.button.callback('🔙 Back to Wallet Admin', 'platform_wallet_admin')]
      ]);

      if (ctx.updateType === 'callback_query') {
        try {
          await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...keyboard
          });
          await this.safeAnswerCbQuery(ctx);
        } catch (error) {
          // Handle "message is not modified" error
          if (error.response && error.response.error_code === 400 && 
              error.response.description.includes('message is not modified')) {
            await this.safeAnswerCbQuery(ctx);
            return;
          }
          throw error;
        }
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
        await this.safeAnswerCbQuery(ctx);
      }
    } catch (error) {
      console.error('Show pending withdrawals error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading pending withdrawals');
    }
  }

  static async handleApproveDeposit(ctx, transactionId) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      if (!transactionId) {
        transactionId = ctx.match[1];
      }

      const result = await WalletService.approveDeposit(transactionId, ctx.from.id);

      await ctx.reply(
        `✅ *Deposit Approved!*\n\n` +
        `*Transaction ID:* ${result.depositId}\n` +
        `*User ID:* ${result.userId}\n` +
        `*Amount:* ${result.amount.toFixed(2)} BOM\n` +
        `*New Balance:* ${result.newBalance.toFixed(2)} BOM\n\n` +
        `User has been notified of the deposit approval.`,
        { parse_mode: 'Markdown' }
      );

      // Notify user
      try {
        await ctx.telegram.sendMessage(
          result.userId,
          `✅ *Deposit Approved!*\n\n` +
          `Your deposit of ${result.amount.toFixed(2)} BOM has been approved.\n\n` +
          `*New Balance:* ${result.newBalance.toFixed(2)} BOM\n` +
          `Check your wallet: /wallet`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      // Refresh pending deposits
      await this.showPendingDeposits(ctx);
    } catch (error) {
      console.error('Approve deposit error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async handleRejectDeposit(ctx, transactionId) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      if (!transactionId) {
        transactionId = ctx.match[1];
      }

      await ctx.reply(
        `Please enter the reason for rejecting deposit ${transactionId}:`,
        {
          reply_markup: {
            keyboard: [[{ text: 'Cancel' }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );

      platformAdminSessions.set(ctx.from.id, {
        action: 'reject_deposit',
        step: 'awaiting_reason',
        transactionId: transactionId
      });
    } catch (error) {
      console.error('Reject deposit error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async handleApproveWithdrawal(ctx, transactionId) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      if (!transactionId) {
        transactionId = ctx.match[1];
      }

      const result = await WalletService.approveWithdrawal(transactionId, ctx.from.id);

      await ctx.reply(
        `✅ *Withdrawal Approved!*\n\n` +
        `*Transaction ID:* ${result.withdrawalId}\n` +
        `*User ID:* ${result.userId}\n` +
        `*Amount:* ${result.amount.toFixed(2)} BOM\n` +
        `*Method:* ${result.method}\n\n` +
        `User has been notified of the approval.`,
        { parse_mode: 'Markdown' }
      );

      // Notify user
      try {
        await ctx.telegram.sendMessage(
          result.userId,
          `✅ *Withdrawal Approved!*\n\n` +
          `Your withdrawal request has been approved.\n\n` +
          `*Amount:* ${result.amount.toFixed(2)} BOM\n` +
          `*Method:* ${result.method}\n\n` +
          `The funds will be sent to your provided payout details.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      // Refresh pending withdrawals
      await this.showPendingWithdrawals(ctx);
    } catch (error) {
      console.error('Approve withdrawal error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async handleRejectWithdrawal(ctx, transactionId) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      if (!transactionId) {
        transactionId = ctx.match[1];
      }

      await ctx.reply(
        `Please enter the reason for rejecting withdrawal ${transactionId}:`,
        {
          reply_markup: {
            keyboard: [[{ text: 'Cancel' }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );

      platformAdminSessions.set(ctx.from.id, {
        action: 'reject_withdrawal',
        step: 'awaiting_reason',
        transactionId: transactionId
      });
    } catch (error) {
      console.error('Reject withdrawal error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async handleMarkAsCompleted(ctx, transactionId) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      if (!transactionId) {
        transactionId = ctx.match[1];
      }

      const result = await WalletService.markWithdrawalAsCompleted(transactionId, ctx.from.id);

      await ctx.reply(
        `✅ *Withdrawal Marked as Completed!*\n\n` +
        `*Transaction ID:* ${result.withdrawalId}\n` +
        `*User ID:* ${result.userId}\n` +
        `*Amount:* ${result.amount.toFixed(2)} BOM\n\n` +
        `This withdrawal has been marked as processed.`,
        { parse_mode: 'Markdown' }
      );

      // Refresh pending withdrawals
      await this.showPendingWithdrawals(ctx);
    } catch (error) {
      console.error('Mark as completed error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async handleWalletReport(ctx) {
    try {
        if (!this.isPlatformCreator(ctx.from.id)) {
            await ctx.reply('❌ Admin access required.');
            return;
        }

        const report = await WalletService.generateWalletReport();
        
        // Add timestamp to make message unique
        const timestamp = new Date().toLocaleTimeString();
        const message = `📊 *Wallet Report*\n\n` +
            `*Total Wallets:* ${report.totalWallets}\n` +
            `*Active Wallets:* ${report.activeWallets}\n` +
            `*Frozen Wallets:* ${report.frozenWallets}\n` +
            `*Total BOM Balance:* ${report.totalBOMBalance.toFixed(2)}\n` +
            `*Total USD Value:* $${report.totalUSDValue.toFixed(2)}\n\n` +
            `*Recent Transactions (24h):*\n` +
            `• Deposits: ${report.recentDeposits}\n` +
            `• Withdrawals: ${report.recentWithdrawals}\n` +
            `• Transfers: ${report.recentTransfers}\n\n` +
            `*Pending Actions:*\n` +
            `• Pending Deposits: ${report.pendingDeposits}\n` +
            `• Pending Withdrawals: ${report.pendingWithdrawals}\n\n` +
            `*Platform Revenue:*\n` +
            `• Net Revenue: ${report.totalBOMBalance.toFixed(2)} BOM\n\n` +
            `*Updated:* ${timestamp}`;  // Add timestamp here

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Refresh Report', 'platform_wallet_report')],
            [Markup.button.callback('🔙 Back to Wallet Admin', 'platform_wallet_admin')]
        ]);

        if (ctx.updateType === 'callback_query') {
            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
        } else {
            await ctx.replyWithMarkdown(message, keyboard);
        }
        
        await this.safeAnswerCbQuery(ctx);
    } catch (error) {
        console.error('Wallet report error:', error);
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Error generating wallet report.');
    }
  }

  static async startAddBOM(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'add_bom',
        step: 'awaiting_user_id'
      });

      const message = `💰 *Add BOM to User*\n\n` +
        `Please provide the user's Telegram ID or username:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Cancel:* Type /cancel or use back button`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Wallet Admin', 'platform_wallet_admin')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        await this.safeAnswerCbQuery(ctx);
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
    } catch (error) {
      console.error('Start add BOM error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting add BOM process');
    }
  }

  static async startFreezeWallet(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'freeze_wallet',
        step: 'awaiting_user_id'
      });

      const message = `❄️ *Freeze Wallet*\n\n` +
        `Please provide the user's Telegram ID or username to freeze:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Cancel:* Type /cancel or use back button`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Wallet Admin', 'platform_wallet_admin')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        await this.safeAnswerCbQuery(ctx);
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
    } catch (error) {
      console.error('Start freeze wallet error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting freeze process');
    }
  }

  static async startUnfreezeWallet(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'unfreeze_wallet',
        step: 'awaiting_user_id'
      });

      const message = `✅ *Unfreeze Wallet*\n\n` +
        `Please provide the user's Telegram ID or username to unfreeze:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Cancel:* Type /cancel or use back button`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Wallet Admin', 'platform_wallet_admin')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        await this.safeAnswerCbQuery(ctx);
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
    } catch (error) {
      console.error('Start unfreeze wallet error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting unfreeze process');
    }
  }

  // ==================== SUBSCRIPTION ADMIN METHODS ====================

  static async subscriptionAdminDashboard(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      let stats = {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        freemiumUsers: 0,
        premiumUsers: 0,
        monthlyRevenue: 0,
        estimatedAnnualRevenue: 0,
        conversionRate: 0
      };
      
      try {
        stats = await SubscriptionService.getSubscriptionStats();
      } catch (error) {
        console.log('⚠️ Could not load subscription stats:', error.message);
      }

      const message = `🎫 *Subscription Admin*\n\n` +
        `*Statistics:*\n` +
        `▫️ Total Subscriptions: ${stats.totalSubscriptions}\n` +
        `▫️ Active Premium: ${stats.activeSubscriptions}\n` +
        `▫️ Freemium Users: ${stats.freemiumUsers}\n` +
        `▫️ Premium Users: ${stats.premiumUsers}\n` +
        `▫️ Monthly Revenue: ${stats.monthlyRevenue.toFixed(2)} BOM\n` +
        `▫️ Annual Revenue: ${stats.estimatedAnnualRevenue.toFixed(2)} BOM\n` +
        `▫️ Conversion Rate: ${stats.conversionRate.toFixed(1)}%\n\n` +
        `*Actions:*`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⭐ Grant Premium', 'platform_grant_premium')],
        [Markup.button.callback('❌ Revoke Premium', 'platform_revoke_premium')],
        [Markup.button.callback('📅 Extend Premium', 'platform_extend_premium')],
        [Markup.button.callback('🔄 Force Renewal Check', 'platform_force_renewal')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Subscription admin dashboard error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading subscription dashboard.');
    }
  }

  static async startGrantPremium(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'grant_premium',
        step: 'awaiting_user_id'
      });

      const message = `⭐ *Grant Premium Subscription*\n\n` +
        `Please provide the user's Telegram ID or username:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Note:* This will give premium for 30 days without charging BOM.\n\n` +
        `*Cancel:* Type /cancel or use back button`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel', 'platform_subscription_admin')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        await this.safeAnswerCbQuery(ctx);
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
    } catch (error) {
      console.error('Start grant premium error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting grant premium process');
    }
  }

  static async startRevokePremium(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'revoke_premium',
        step: 'awaiting_user_id'
      });

      const message = `❌ *Revoke Premium Subscription*\n\n` +
        `Please provide the user's Telegram ID or username:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Warning:* This will immediately revoke premium access.\n\n` +
        `*Cancel:* Type /cancel or use back button`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel', 'platform_subscription_admin')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        await this.safeAnswerCbQuery(ctx);
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
    } catch (error) {
      console.error('Start revoke premium error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting revoke premium process');
    }
  }

  static async startExtendPremium(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'extend_premium',
        step: 'awaiting_user_id'
      });

      const message = `📅 *Extend Premium Subscription*\n\n` +
        `Please provide the user's Telegram ID or username:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Cancel:* Type /cancel or use back button`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel', 'platform_subscription_admin')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        await this.safeAnswerCbQuery(ctx);
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
    } catch (error) {
      console.error('Start extend premium error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting extend premium process');
    }
  }

  static async handleForceRenewalCheck(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      const result = await SubscriptionService.checkAllRenewals();
      
      const message = `🔄 *Force Renewal Check Completed*\n\n` +
        `*Results:*\n` +
        `✅ Processed: ${result.processed || 0}\n` +
        `❌ Failed: ${result.failed || 0}\n` +
        `📊 Total Checked: ${result.total || 0}\n\n` +
        `All subscriptions have been checked for renewal.`;

      await ctx.replyWithMarkdown(message);
    } catch (error) {
      console.error('Force renewal check error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  // ==================== USER MANAGEMENT METHODS ====================

  static async userManagement(ctx, page = 1) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const limit = 10;
      const offset = (page - 1) * limit;

      const { count, rows: users } = await User.findAndCountAll({
        order: [['last_active', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `👥 *User Management* - Page ${page}/${totalPages}\n\n` +
        `*Total Users:* ${formatNumber(count)}\n\n` +
        `*Recent Users:*\n`;

      users.forEach((user, index) => {
        const username = user.username ? `@${user.username}` : 'No username';
        const status = user.is_banned ? '🚫 BANNED' : '✅ Active';
        
        message += `*${offset + index + 1}.* ${username} (${user.first_name || 'No name'})\n` +
          `   Status: ${status}\n` +
          `   Last Active: ${user.last_active ? user.last_active.toLocaleDateString() : 'Never'}\n` +
          `   ID: ${user.telegram_id}\n\n`;
      });

      const keyboardButtons = [];
      if (page > 1) {
        keyboardButtons.push(Markup.button.callback('⬅️ Previous', `platform_users:${page - 1}`));
      }
      if (page < totalPages) {
        keyboardButtons.push(Markup.button.callback('Next ➡️', `platform_users:${page + 1}`));
      }

      const keyboard = Markup.inlineKeyboard([
        keyboardButtons,
        [
          Markup.button.callback('🚫 Ban User', 'platform_ban_user'),
          Markup.button.callback('✅ Unban User', 'platform_unban_user')
        ],
        [Markup.button.callback('📊 User Statistics', 'platform_user_stats')],
        [Markup.button.callback('📋 Export Users', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('User management error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading users');
    }
  }

  // ==================== BOT MANAGEMENT METHODS ====================

  static async botManagement(ctx, page = 1) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const limit = 8;
      const offset = (page - 1) * limit;

      const { count, rows: bots } = await Bot.findAndCountAll({
        include: [{
          model: User,
          as: 'Owner',
          attributes: ['username', 'first_name', 'is_banned']
        }],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      // Use HTML formatting instead of Markdown for better reliability
      let message = `<b>🤖 Bot Management</b> - Page ${page}/${totalPages}\n\n` +
        `<b>Total Bots:</b> ${formatNumber(count)}\n\n` +
        `<b>Recent Bots:</b>\n`;

      bots.forEach((bot, index) => {
        // Clean and escape HTML entities
        const botName = this.cleanTextForHTML(bot.bot_name || 'Unnamed Bot');
        const botUsername = bot.bot_username ? this.cleanTextForHTML(bot.bot_username) : 'no_username';
        
        // Format owner info safely
        let ownerInfo = 'Unknown';
        if (bot.Owner) {
          if (bot.Owner.username) {
            ownerInfo = `@${this.cleanTextForHTML(bot.Owner.username)}`;
          } else if (bot.Owner.first_name) {
            ownerInfo = this.cleanTextForHTML(bot.Owner.first_name);
          }
        }
        
        const status = bot.is_active ? '🟢 Active' : '🔴 Inactive';
        const createdDate = bot.created_at ? bot.created_at.toLocaleDateString() : 'Unknown';
        
        // Build each bot entry safely
        message += `<b>${offset + index + 1}.</b> ${botName} (@${botUsername})\n` +
          `   Owner: ${ownerInfo}\n` +
          `   Status: ${status}\n` +
          `   Created: ${createdDate}\n` +
          `   ID: ${bot.id}\n\n`;
      });

      // Debug: Check the message length
      console.log(`Bot management message length: ${message.length}`);
      if (message.length > 4000) {
        // Telegram has a 4096 character limit, trim if needed
        message = message.substring(0, 4000) + '\n\n[Message truncated...]';
      }

      // Build keyboard safely
      const keyboardButtons = [];
      if (page > 1) {
        keyboardButtons.push(Markup.button.callback('⬅️ Previous', `platform_bots:${page - 1}`));
      }
      if (page < totalPages) {
        keyboardButtons.push(Markup.button.callback('Next ➡️', `platform_bots:${page + 1}`));
      }

      const keyboardRows = [];
      if (keyboardButtons.length > 0) {
        keyboardRows.push(keyboardButtons);
      }
      
      keyboardRows.push([
        Markup.button.callback('🔄 Toggle Bot', 'platform_toggle_bot'),
        Markup.button.callback('🗑️ Delete Bot', 'platform_delete_bot')
      ]);
      
      keyboardRows.push([Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]);

      const keyboard = Markup.inlineKeyboard(keyboardRows);

      if (ctx.updateType === 'callback_query') {
        try {
          await ctx.editMessageText(message, {
            parse_mode: 'HTML',  // Changed from Markdown to HTML
            ...keyboard
          });
          await this.safeAnswerCbQuery(ctx);
        } catch (error) {
          console.error('Edit message error:', error.message);
          // Try with plain text
          try {
            await ctx.editMessageText(message.replace(/<[^>]*>/g, ''), {
              parse_mode: null,
              ...keyboard
            });
          } catch (fallbackError) {
            // Send as new message
            await ctx.reply(message.replace(/<[^>]*>/g, ''), keyboard);
          }
          await this.safeAnswerCbQuery(ctx);
        }
      } else {
        try {
          await ctx.reply(message, {
            parse_mode: 'HTML',
            ...keyboard
          });
        } catch (error) {
          console.error('Reply error:', error.message);
          // Fallback without HTML
          await ctx.reply(message.replace(/<[^>]*>/g, ''), keyboard);
        }
      }
      
    } catch (error) {
      console.error('Bot management error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading bots');
    }
  }

  // Add this helper method
  static cleanTextForHTML(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==================== BAN MANAGEMENT METHODS ====================

  static async banManagement(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const bannedUsers = await User.findAll({
        where: { is_banned: true },
        order: [['banned_at', 'DESC']],
        limit: 15
      });

      let message = `🚫 *Ban Management*\n\n` +
        `*Banned Users:* ${bannedUsers.length}\n\n`;

      if (bannedUsers.length === 0) {
        message += `No users are currently banned.`;
      } else {
        bannedUsers.forEach((user, index) => {
          const username = user.username ? `@${user.username}` : 'No username';
          const reason = user.ban_reason || 'Not specified';
          
          message += `*${index + 1}.* ${username} (${user.first_name || 'No name'})\n` +
            `   Banned: ${user.banned_at ? user.banned_at.toLocaleDateString() : 'Unknown'}\n` +
            `   Reason: ${reason}\n` +
            `   ID: ${user.telegram_id}\n\n`;
        });
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Ban User', 'platform_ban_user')],
        [Markup.button.callback('✅ Unban User', 'platform_unban_user')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Ban management error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading ban list');
    }
  }

  static async startBanUser(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'ban_user',
        step: 'awaiting_user_id'
      });

      const message = `🚫 *Ban User*\n\n` +
        `Please provide the user's Telegram ID or username to ban:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Cancel:* Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bans')]
          ])
        });
      } else {
        await ctx.replyWithMarkdown(message, 
          Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bans')]
          ])
        );
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Start ban user error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting ban process');
    }
  }

  static async startUnbanUser(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'unban_user',
        step: 'awaiting_user_id'
      });

      const message = `✅ *Unban User*\n\n` +
        `Please provide the user's Telegram ID or username to unban:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Cancel:* Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bans')]
          ])
        });
      } else {
        await ctx.replyWithMarkdown(message, 
          Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bans')]
          ])
        );
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Start unban user error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting unban process');
    }
  }

  // ==================== BROADCAST METHODS ====================

  static async startPlatformBroadcast(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const totalUsers = await User.count();

      platformAdminSessions.set(ctx.from.id, {
        action: 'platform_broadcast',
        step: 'awaiting_message'
      });

      const message = `📢 *Platform Broadcast*\n\n` +
        `*Recipients:* ${formatNumber(totalUsers)} users\n\n` +
        `⚠️ *Important:* This will send a message to ALL users of the platform.\n\n` +
        `Please type your broadcast message:\n\n` +
        `*Cancel:* Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_dashboard')]
          ])
        });
      } else {
        await ctx.replyWithMarkdown(message, 
          Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_dashboard')]
          ])
        );
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Start platform broadcast error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting broadcast');
    }
  }

  static async sendPlatformBroadcast(ctx, message) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Access denied');
        return;
      }

      const users = await User.findAll({
        attributes: ['telegram_id', 'username', 'first_name'],
        where: { is_banned: false }
      });

      const progressMsg = await ctx.reply(
        `📢 *Platform Broadcast Started*\n\n` +
        `🔄 Sending to ${formatNumber(users.length)} users...\n` +
        `✅ Sent: 0\n` +
        `❌ Failed: 0\n` +
        `⏰ Estimated time: ${Math.ceil(users.length / 20)} seconds`,
        { parse_mode: 'Markdown' }
      );

      let successCount = 0;
      let failCount = 0;
      const failedUsers = [];
      const startTime = Date.now();

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          await ctx.telegram.sendMessage(user.telegram_id, message, {
            parse_mode: 'Markdown'
          });
          successCount++;

          if (i % 20 === 0 || i === users.length - 1) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.ceil((users.length - i) / 20);
            
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              progressMsg.message_id,
              null,
              `📢 *Platform Broadcast Progress*\n\n` +
              `🔄 Sending to ${formatNumber(users.length)} users...\n` +
              `✅ Sent: ${formatNumber(successCount)}\n` +
              `❌ Failed: ${formatNumber(failCount)}\n` +
              `⏰ Elapsed: ${elapsed}s | Remaining: ~${remaining}s`,
              { parse_mode: 'Markdown' }
            );
          }

          if (i % 30 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          failCount++;
          failedUsers.push({
            id: user.telegram_id,
            username: user.username,
            error: error.message
          });
          console.error(`Failed to send to user ${user.telegram_id}:`, error.message);
        }
      }

      const totalTime = Math.floor((Date.now() - startTime) / 1000);
      const successRate = ((successCount / users.length) * 100).toFixed(1);

      try {
        await BroadcastHistory.create({
          bot_id: null,
          sent_by: ctx.from.id,
          message: message.substring(0, 1000),
          total_users: users.length,
          successful_sends: successCount,
          failed_sends: failCount,
          broadcast_type: 'platform'
        });
      } catch (dbError) {
        console.error('Failed to save broadcast history:', dbError.message);
      }

      let resultMessage = `✅ *Platform Broadcast Completed!*\n\n` +
        `*Summary:*\n` +
        `👥 Total Recipients: ${formatNumber(users.length)}\n` +
        `✅ Successful: ${formatNumber(successCount)}\n` +
        `❌ Failed: ${formatNumber(failCount)}\n` +
        `📊 Success Rate: ${successRate}%\n` +
        `⏰ Total Time: ${totalTime} seconds\n\n`;

      if (failCount > 0) {
        resultMessage += `*Common failure reasons:*\n` +
          `• User blocked the bot\n` +
          `• User account deleted\n` +
          `• Rate limiting\n\n` +
          `Failed users: ${failedUsers.length}`;
      }

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        resultMessage,
        { parse_mode: 'Markdown' }
      );

      platformAdminSessions.delete(ctx.from.id);
    } catch (error) {
      console.error('Send platform broadcast error:', error);
      await ctx.reply('❌ Error sending platform broadcast: ' + error.message);
      platformAdminSessions.delete(ctx.from.id);
    }
  }

  // ==================== ANALYTICS METHODS ====================

  static async advancedAnalytics(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        newUsers,
        newBots,
        activeUsers,
        messagesStats
      ] = await Promise.all([
        User.count({
          where: {
            created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          }
        }),
        Bot.count({
          where: {
            created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          }
        }),
        User.count({
          where: {
            last_active: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          }
        }),
        Feedback.findAll({
          where: {
            created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          },
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN is_replied = true THEN 1 ELSE 0 END')), 'replied']
          ],
          raw: true
        })
      ]);

      const totalMessages = parseInt(messagesStats[0]?.total || 0);
      const repliedMessages = parseInt(messagesStats[0]?.replied || 0);
      const replyRate = totalMessages > 0 ? ((repliedMessages / totalMessages) * 100).toFixed(1) : '0';

      const analyticsMessage = `📊 *Advanced Analytics* (Last 30 Days)\n\n` +
        `*User Growth:*\n` +
        `👥 New Users: ${formatNumber(newUsers)}\n` +
        `👥 Active Users: ${formatNumber(activeUsers)}\n\n` +
        `*Bot Activity:*\n` +
        `🤖 New Bots: ${formatNumber(newBots)}\n\n` +
        `*Messaging:*\n` +
        `💬 Total Messages: ${formatNumber(totalMessages)}\n` +
        `✅ Replied Messages: ${formatNumber(repliedMessages)}\n` +
        `📊 Reply Rate: ${replyRate}%\n\n` +
        `*Platform Health:*\n` +
        `🟢 System: Operational\n` +
        `📈 Trend: Growing`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Detailed Reports', 'platform_detailed_reports')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(analyticsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(analyticsMessage, keyboard);
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Advanced analytics error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading analytics');
    }
  }

  static async userStatistics(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const [
        totalUsers,
        bannedUsers,
        activeToday,
        activeWeek,
        newToday,
        newWeek,
        usersWithBots
      ] = await Promise.all([
        User.count(),
        User.count({ where: { is_banned: true } }),
        User.count({
          where: {
            last_active: { [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        User.count({
          where: {
            last_active: { [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        }),
        User.count({
          where: {
            created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        User.count({
          where: {
            created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        }),
        User.count({
          include: [{
            model: Bot,
            as: 'OwnedBots',
            required: true
          }]
        })
      ]);

      const botOwnershipRate = ((usersWithBots / totalUsers) * 100).toFixed(1);
      const userRetention = ((activeWeek / totalUsers) * 100).toFixed(1);
      const growthRate = ((newWeek / totalUsers) * 100).toFixed(1);

      const statsMessage = `📊 *User Statistics*\n\n` +
        `*Overview:*\n` +
        `👥 Total Users: ${formatNumber(totalUsers)}\n` +
        `🚫 Banned Users: ${formatNumber(bannedUsers)}\n` +
        `✅ Active Users: ${formatNumber(totalUsers - bannedUsers)}\n\n` +
        `*Activity:*\n` +
        `📈 Active Today: ${formatNumber(activeToday)}\n` +
        `📈 Active This Week: ${formatNumber(activeWeek)}\n` +
        `🆕 New Today: ${formatNumber(newToday)}\n` +
        `🆕 New This Week: ${formatNumber(newWeek)}\n\n` +
        `*Bot Ownership:*\n` +
        `🤖 Users with Bots: ${formatNumber(usersWithBots)}\n` +
        `📊 Bot Ownership Rate: ${botOwnershipRate}%\n\n` +
        `*Platform Health:*\n` +
        `📱 User Retention: ${userRetention}%\n` +
        `🚀 Growth Rate: ${growthRate}%`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Detailed Reports', 'platform_detailed_reports')],
        [Markup.button.callback('📋 Export Users', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(statsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(statsMessage, keyboard);
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('User statistics error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading user statistics');
    }
  }

  static async detailedReports(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const [
        userGrowth,
        botGrowth,
        messageStats,
        broadcastStats,
        totalUsers
      ] = await Promise.all([
        User.count({
          where: {
            created_at: { 
              [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          }
        }),
        Bot.count({
          where: {
            created_at: { 
              [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          }
        }),
        Feedback.findAll({
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN is_replied = true THEN 1 ELSE 0 END')), 'replied']
          ],
          raw: true
        }),
        BroadcastHistory.findAll({
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').col('total_users')), 'total_recipients'],
            [require('sequelize').fn('AVG', require('sequelize').col('successful_sends')), 'avg_success_rate']
          ],
          raw: true
        }),
        User.count()
      ]);

      const totalMessages = parseInt(messagesStats[0]?.total || 0);
      const repliedMessages = parseInt(messagesStats[0]?.replied || 0);
      const totalBroadcasts = parseInt(broadcastStats[0]?.total || 0);
      const totalRecipients = parseInt(broadcastStats[0]?.total_recipients || 0);
      const avgSuccessRate = parseFloat(broadcastStats[0]?.avg_success_rate || 0);

      const replyRate = totalMessages > 0 ? ((repliedMessages / totalMessages) * 100).toFixed(1) : '0';
      const userGrowthRate = totalUsers > 0 ? ((userGrowth / totalUsers) * 100).toFixed(1) : '0';

      const reportsMessage = `📈 *Detailed Platform Reports*\n\n` +
        `*Message Analytics:*\n` +
        `💬 Total Messages: ${formatNumber(totalMessages)}\n` +
        `✅ Replied Messages: ${formatNumber(repliedMessages)}\n` +
        `📊 Reply Rate: ${replyRate}%\n\n` +
        `*Broadcast Performance:*\n` +
        `📢 Total Broadcasts: ${formatNumber(totalBroadcasts)}\n` +
        `👥 Total Recipients: ${formatNumber(totalRecipients)}\n` +
        `📈 Avg Success Rate: ${avgSuccessRate.toFixed(1)}%\n\n` +
        `*Growth Trends (Last 7 Days):*\n` +
        `👥 New Users: ${formatNumber(userGrowth)}\n` +
        `🤖 New Bots: ${formatNumber(botGrowth)}\n\n` +
        `*Platform Insights:*\n` +
        `📱 Daily User Growth Rate: ${userGrowthRate}%\n` +
        `🚀 Bot Creation Rate: ${((botGrowth / 7) || 0).toFixed(1)} bots/day\n` +
        `💬 Message Activity: ${((totalMessages / 30) || 0).toFixed(1)} msgs/day`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 User Statistics', 'platform_user_stats')],
        [Markup.button.callback('📋 Export Data', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(reportsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(reportsMessage, keyboard);
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Detailed reports error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading detailed reports');
    }
  }

  // ==================== BOT MANAGEMENT ACTIONS ====================

  static async startToggleBot(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'toggle_bot',
        step: 'awaiting_bot_id'
      });

      const message = `🔄 *Toggle Bot Status*\n\n` +
        `Please provide the bot ID or username to toggle:\n\n` +
        `*Examples:*\n` +
        `• 123 (Bot ID)\n` +
        `• @botusername\n\n` +
        `*Cancel:* Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bots')]
          ])
        });
      } else {
        await ctx.replyWithMarkdown(message, 
          Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bots')]
          ])
        );
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Start toggle bot error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting toggle process');
    }
  }

  static async startDeleteBot(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'delete_bot',
        step: 'awaiting_bot_id'
      });

      const message = `🗑️ *Delete Bot*\n\n` +
        `⚠️ *Warning:* This will permanently delete the bot and all its data!\n\n` +
        `Please provide the bot ID or username to delete:\n\n` +
        `*Examples:*\n` +
        `• 123 (Bot ID)\n` +
        `• @botusername\n\n` +
        `*Cancel:* Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bots')]
          ])
        });
      } else {
        await ctx.replyWithMarkdown(message, 
          Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bots')]
          ])
        );
      }
      
      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Start delete bot error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting delete process');
    }
  }

  // ==================== EXPORT METHODS ====================

  static async exportUsers(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const users = await User.findAll({
        attributes: ['telegram_id', 'username', 'first_name', 'last_name', 'is_banned', 'created_at', 'last_active'],
        order: [['created_at', 'DESC']]
      });

      if (users.length === 0) {
        await this.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ No users to export');
        return;
      }

      let csvContent = 'User ID,Username,First Name,Last Name,Status,Created At,Last Active\n';
      
      users.forEach(user => {
        const status = user.is_banned ? 'Banned' : 'Active';
        const createdAt = user.created_at.toISOString().split('T')[0];
        const lastActive = user.last_active ? user.last_active.toISOString().split('T')[0] : 'Never';
        
        csvContent += `${user.telegram_id},${user.username || ''},${user.first_name || ''},${user.last_name || ''},${status},${createdAt},${lastActive}\n`;
      });

      await ctx.replyWithDocument({
        source: Buffer.from(csvContent, 'utf8'),
        filename: `platform_users_${new Date().toISOString().split('T')[0]}.csv`
      }, {
        caption: `📋 *User Export Complete*\n\n` +
                `*Total Users:* ${formatNumber(users.length)}\n` +
                `*Export Date:* ${new Date().toLocaleDateString()}\n\n` +
                `The file contains all user data in CSV format.`,
        parse_mode: 'Markdown'
      });

      await this.safeAnswerCbQuery(ctx);
    } catch (error) {
      console.error('Export users error:', error);
      await this.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error exporting users');
    }
  }

  // ==================== WALLET ACTION PROCESSORS ====================

  static async processAddBOMStep1(ctx, userIdentifier) {
    try {
      console.log(`Processing add BOM step 1 for: ${userIdentifier}`);
      
      let user;
      if (isNaN(userIdentifier)) {
        const username = userIdentifier.replace('@', '').trim();
        user = await User.findOne({ where: { username: username } });
      } else {
        user = await User.findOne({ where: { telegram_id: parseInt(userIdentifier) } });
      }

      if (!user) {
        await ctx.reply('❌ User not found. Please check the ID or username.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'add_bom_amount',
        step: 'awaiting_amount',
        userIdentifier: userIdentifier,
        userId: user.telegram_id
      });

      await ctx.reply(
        `💰 *Add BOM to User*\n\n` +
        `User: ${user.username ? `@${user.username}` : user.first_name} (ID: ${user.telegram_id})\n\n` +
        `Please enter the amount of BOM to add:\n\n` +
        `*Examples:*\n` +
        `• 50 (for 50 BOM)\n` +
        `• 100.50 (for 100.50 BOM)\n\n` +
        `*Cancel:* Type /cancel`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back', 'platform_wallet_admin')]
          ])
        }
      );
    } catch (error) {
      console.error('Process add BOM step 1 error:', error);
      await ctx.reply('❌ Error processing request.');
    }
  }

  static async processAddBOMStep2(ctx, userIdentifier, amountInput) {
    try {
      const amount = parseFloat(amountInput);
      
      if (!amount || amount <= 0 || isNaN(amount)) {
        await ctx.reply('❌ Invalid amount. Please enter a positive number.');
        return;
      }

      let userId;
      if (isNaN(userIdentifier)) {
        const username = userIdentifier.replace('@', '').trim();
        const user = await User.findOne({ where: { username: username } });
        if (!user) {
          await ctx.reply('❌ User not found.');
          return;
        }
        userId = user.telegram_id;
      } else {
        userId = parseInt(userIdentifier);
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'add_bom_confirm',
        step: 'awaiting_confirmation',
        userId: userId,
        amount: amount,
        userIdentifier: userIdentifier
      });

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Yes, Add BOM', `platform_confirm_add_bom_${userId}_${amount}`),
          Markup.button.callback('❌ Cancel', 'platform_wallet_admin')
        ]
      ]);

      await ctx.reply(
        `🔍 *Confirm BOM Addition*\n\n` +
        `*User ID:* ${userId}\n` +
        `*Amount:* ${amount.toFixed(2)} BOM ($${amount.toFixed(2)})\n\n` +
        `*Rate:* 1 BOM = $1.00 USD\n\n` +
        `Proceed with this transaction?`,
        { parse_mode: 'Markdown', ...keyboard }
      );
    } catch (error) {
      console.error('Process add BOM step 2 error:', error);
      await ctx.reply('❌ Error processing amount.');
    }
  }

  static async confirmAddBOM(ctx, userId, amount) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }

      await ctx.answerCbQuery('🔄 Adding BOM...');

      const result = await WalletService.adminAdjustBalance(
        userId, 
        amount, 
        'Manual BOM addition by admin', 
        ctx.from.id
      );

      const user = await User.findOne({ where: { telegram_id: userId } });
      const userName = user ? (user.username ? `@${user.username}` : user.first_name) : `User ${userId}`;

      await ctx.editMessageText(
        `✅ *BOM Added Successfully!*\n\n` +
        `*User:* ${userName}\n` +
        `*User ID:* ${userId}\n` +
        `*Amount Added:* ${amount.toFixed(2)} BOM ($${amount.toFixed(2)})\n` +
        `*New Balance:* ${result.newBalance.toFixed(2)} BOM\n` +
        `*Transaction ID:* ${result.transaction.id}\n\n` +
        `User has been notified of the deposit.`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🏦 Back to Wallet Admin', 'platform_wallet_admin')]
          ])
        }
      );

      try {
        await ctx.telegram.sendMessage(
          userId,
          `💰 *BOM Deposit Confirmed!*\n\n` +
          `✅ Your wallet has been credited with ${amount.toFixed(2)} BOM ($${amount.toFixed(2)}).\n\n` +
          `*New Balance:* ${result.newBalance.toFixed(2)} BOM\n` +
          `*Transaction:* Manual BOM addition by admin\n\n` +
          `Check your wallet: /wallet`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      platformAdminSessions.delete(ctx.from.id);
    } catch (error) {
      console.error('Confirm add BOM error:', error);
      await ctx.editMessageText(`❌ Error: ${error.message}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏦 Back to Wallet Admin', 'platform_wallet_admin')]
        ])
      });
    }
  }

  static async processFreezeWalletStep1(ctx, userIdentifier) {
    try {
      let user;
      if (isNaN(userIdentifier)) {
        const username = userIdentifier.replace('@', '').trim();
        user = await User.findOne({ where: { username: username } });
      } else {
        user = await User.findOne({ where: { telegram_id: parseInt(userIdentifier) } });
      }

      if (!user) {
        await ctx.reply('❌ User not found. Please check the ID or username.');
        return;
      }

      const wallet = await WalletService.getBalance(user.telegram_id);
      if (wallet.isFrozen) {
        await ctx.reply('❌ This wallet is already frozen.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'freeze_wallet_reason',
        step: 'awaiting_reason',
        userId: user.telegram_id
      });

      await ctx.reply(
        `❄️ *Freeze Wallet*\n\n` +
        `User: ${user.username ? `@${user.username}` : user.first_name} (ID: ${user.telegram_id})\n` +
        `Current Balance: ${wallet.balance.toFixed(2)} BOM\n\n` +
        `Please enter the reason for freezing this wallet:\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Process freeze wallet step 1 error:', error);
      await ctx.reply('❌ Error processing request.');
    }
  }

  static async processFreezeWalletStep2(ctx, userId, reason) {
    try {
      if (!reason || reason.trim() === '') {
        await ctx.reply('❌ Please provide a reason for freezing.');
        return;
      }

      await WalletService.freezeWallet(userId, reason.trim(), ctx.from.id);

      const user = await User.findOne({ where: { telegram_id: userId } });
      const userName = user ? (user.username ? `@${user.username}` : user.first_name) : `User ${userId}`;

      await ctx.reply(
        `❄️ *Wallet Frozen Successfully!*\n\n` +
        `*User:* ${userName}\n` +
        `*User ID:* ${userId}\n` +
        `*Reason:* ${reason}\n\n` +
        `Wallet is now frozen and cannot perform any transactions.`,
        { parse_mode: 'Markdown' }
      );

      try {
        await ctx.telegram.sendMessage(
          userId,
          `❄️ *Wallet Frozen*\n\n` +
          `Your Botomics wallet has been frozen by platform admin.\n\n` +
          `*Reason:* ${reason}\n\n` +
          `All transactions (deposits, withdrawals, transfers) are disabled.\n` +
          `Contact @BotomicsSupportBot for more information.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      platformAdminSessions.delete(ctx.from.id);
      await this.walletAdminDashboard(ctx);
    } catch (error) {
      console.error('Process freeze wallet step 2 error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async processUnfreezeWallet(ctx, userIdentifier) {
    try {
      let user;
      if (isNaN(userIdentifier)) {
        const username = userIdentifier.replace('@', '').trim();
        user = await User.findOne({ where: { username: username } });
      } else {
        user = await User.findOne({ where: { telegram_id: parseInt(userIdentifier) } });
      }

      if (!user) {
        await ctx.reply('❌ User not found. Please check the ID or username.');
        return;
      }

      await WalletService.unfreezeWallet(user.telegram_id, ctx.from.id);

      await ctx.reply(
        `✅ *Wallet Unfrozen Successfully!*\n\n` +
        `*User:* ${user.username ? `@${user.username}` : user.first_name}\n` +
        `*User ID:* ${user.telegram_id}\n\n` +
        `Wallet is now active and can perform transactions again.`,
        { parse_mode: 'Markdown' }
      );

      try {
        await ctx.telegram.sendMessage(
          user.telegram_id,
          `✅ *Wallet Unfrozen*\n\n` +
          `Your Botomics wallet has been unfrozen by platform admin.\n\n` +
          `You can now use all wallet features again.\n` +
          `Check your wallet: /wallet`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      platformAdminSessions.delete(ctx.from.id);
      await this.walletAdminDashboard(ctx);
    } catch (error) {
      console.error('Process unfreeze wallet error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async processGrantPremiumStep1(ctx, userIdentifier) {
    try {
      let user;
      if (isNaN(userIdentifier)) {
        const username = userIdentifier.replace('@', '').trim();
        user = await User.findOne({ where: { username: username } });
      } else {
        user = await User.findOne({ where: { telegram_id: parseInt(userIdentifier) } });
      }

      if (!user) {
        await ctx.reply('❌ User not found. Please check the ID or username.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'grant_premium_duration',
        step: 'awaiting_duration',
        userId: user.telegram_id
      });

      await ctx.reply(
        `⭐ *Grant Premium Subscription*\n\n` +
        `User: ${user.username ? `@${user.username}` : user.first_name} (ID: ${user.telegram_id})\n\n` +
        `Please enter the duration in days:\n\n` +
        `*Examples:*\n` +
        `• 30 (for 30 days)\n` +
        `• 90 (for 90 days)\n` +
        `• 365 (for 1 year)\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Process grant premium step 1 error:', error);
      await ctx.reply('❌ Error processing request.');
    }
  }

  static async processGrantPremiumStep2(ctx, userId, durationInput) {
    try {
      const duration = parseInt(durationInput);
      
      if (!duration || duration <= 0 || isNaN(duration)) {
        await ctx.reply('❌ Invalid duration. Please enter a positive number of days.');
        return;
      }

      const result = await SubscriptionService.forceUpdateSubscription(
        userId, 
        'premium', 
        ctx.from.id,
        `Admin granted premium for ${duration} days`
      );

      const user = await User.findOne({ where: { telegram_id: userId } });
      const userName = user ? (user.username ? `@${user.username}` : user.first_name) : `User ${userId}`;

      await ctx.reply(
        `⭐ *Premium Granted Successfully!*\n\n` +
        `*User:* ${userName}\n` +
        `*User ID:* ${userId}\n` +
        `*Duration:* ${duration} days\n` +
        `*Expires:* ${result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : 'N/A'}\n\n` +
        `User now has premium features for ${duration} days.`,
        { parse_mode: 'Markdown' }
      );

      try {
        await ctx.telegram.sendMessage(
          userId,
          `⭐ *Premium Subscription Activated!*\n\n` +
          `You have been granted a premium subscription for ${duration} days!\n\n` +
          `*You now have access to:*\n` +
          `✅ Unlimited bot creation\n` +
          `✅ Unlimited broadcasts\n` +
          `✅ All premium features\n\n` +
          `Thank you for being part of Botomics! 🚀`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      platformAdminSessions.delete(ctx.from.id);
      await this.subscriptionAdminDashboard(ctx);
    } catch (error) {
      console.error('Process grant premium step 2 error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async processRevokePremium(ctx, userIdentifier) {
    try {
      let user;
      if (isNaN(userIdentifier)) {
        const username = userIdentifier.replace('@', '').trim();
        user = await User.findOne({ where: { username: username } });
      } else {
        user = await User.findOne({ where: { telegram_id: parseInt(userIdentifier) } });
      }

      if (!user) {
        await ctx.reply('❌ User not found. Please check the ID or username.');
        return;
      }

      const result = await SubscriptionService.revokePremium(user.telegram_id, ctx.from.id);

      await ctx.reply(
        `❌ *Premium Revoked Successfully!*\n\n` +
        `*User:* ${user.username ? `@${user.username}` : user.first_name}\n` +
        `*User ID:* ${user.telegram_id}\n\n` +
        `*Result:* ${result.message}\n\n` +
        `User's premium subscription has been revoked. They are now on freemium.`,
        { parse_mode: 'Markdown' }
      );

      try {
        await ctx.telegram.sendMessage(
          user.telegram_id,
          `⚠️ *Premium Subscription Revoked*\n\n` +
          `Your premium subscription has been revoked by platform admin.\n\n` +
          `You are now on the freemium plan.\n` +
          `*Limits:*\n` +
          `• Maximum 5 bots\n` +
          `• Basic features only\n\n` +
          `Contact @BotomicsSupportBot for more information.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      platformAdminSessions.delete(ctx.from.id);
      await this.subscriptionAdminDashboard(ctx);
    } catch (error) {
      console.error('Process revoke premium error:', error);
      await ctx.reply(`❌ Error: ${error.message}\n\nMake sure the user actually has a premium subscription.`);
    }
  }

  static async processExtendPremiumStep1(ctx, userIdentifier) {
    try {
      let user;
      if (isNaN(userIdentifier)) {
        const username = userIdentifier.replace('@', '').trim();
        user = await User.findOne({ where: { username: username } });
      } else {
        user = await User.findOne({ where: { telegram_id: parseInt(userIdentifier) } });
      }

      if (!user) {
        await ctx.reply('❌ User not found. Please check the ID or username.');
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'extend_premium_duration',
        step: 'awaiting_duration',
        userId: user.telegram_id
      });

      await ctx.reply(
        `📅 *Extend Premium Subscription*\n\n` +
        `User: ${user.username ? `@${user.username}` : user.first_name} (ID: ${user.telegram_id})\n\n` +
        `Please enter the number of days to extend:\n\n` +
        `*Examples:*\n` +
        `• 30 (extend by 30 days)\n` +
        `• 90 (extend by 90 days)\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Process extend premium step 1 error:', error);
      await ctx.reply('❌ Error processing request.');
    }
  }

  static async processExtendPremiumStep2(ctx, userId, durationInput) {
    try {
      const duration = parseInt(durationInput);
      
      if (!duration || duration <= 0 || isNaN(duration)) {
        await ctx.reply('❌ Invalid duration. Please enter a positive number of days.');
        return;
      }

      const result = await SubscriptionService.extendPremium(userId, duration, ctx.from.id);

      const user = await User.findOne({ where: { telegram_id: userId } });
      const userName = user ? (user.username ? `@${user.username}` : user.first_name) : `User ${userId}`;

      await ctx.reply(
        `📅 *Premium Extended Successfully!*\n\n` +
        `*User:* ${userName}\n` +
        `*User ID:* ${userId}\n` +
        `*Extension:* ${duration} days\n` +
        `*New Expiry:* ${result.newExpiry ? new Date(result.newExpiry).toLocaleDateString() : 'N/A'}\n\n` +
        `User's premium subscription has been extended.`,
        { parse_mode: 'Markdown' }
      );

      try {
        await ctx.telegram.sendMessage(
          userId,
          `📅 *Premium Subscription Extended!*\n\n` +
          `Your premium subscription has been extended by ${duration} days!\n\n` +
          `*New Expiry Date:* ${result.newExpiry ? new Date(result.newExpiry).toLocaleDateString() : 'N/A'}\n\n` +
          `Thank you for being a valued Botomics user! 🚀`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      platformAdminSessions.delete(ctx.from.id);
      await this.subscriptionAdminDashboard(ctx);
    } catch (error) {
      console.error('Process extend premium step 2 error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  // ==================== TEXT INPUT HANDLER ====================

  static async handlePlatformAdminInput(ctx) {
    try {
      const userId = ctx.from.id;
      const session = platformAdminSessions.get(userId);

      if (!session) {
        console.log(`No admin session for user ${userId}`);
        return;
      }

      const input = ctx.message.text.trim();

      if (input === '/cancel') {
        platformAdminSessions.delete(userId);
        await ctx.reply('❌ Admin action cancelled.', { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🏦 Back to Wallet Admin', 'platform_wallet_admin')]
          ])
        });
        return;
      }

      console.log(`Admin session for ${userId}:`, session);
      console.log(`Input: ${input}`);

      if (session.action === 'add_bom' && session.step === 'awaiting_user_id') {
        await this.processAddBOMStep1(ctx, input);
      } else if (session.action === 'add_bom_amount' && session.step === 'awaiting_amount') {
        await this.processAddBOMStep2(ctx, session.userIdentifier, input);
      } else if (session.action === 'add_bom_confirm' && session.step === 'awaiting_confirmation') {
        await ctx.reply('Please use the confirmation buttons above.');
      } else if (session.action === 'freeze_wallet' && session.step === 'awaiting_user_id') {
        await this.processFreezeWalletStep1(ctx, input);
      } else if (session.action === 'freeze_wallet_reason' && session.step === 'awaiting_reason') {
        await this.processFreezeWalletStep2(ctx, session.userId, input);
      } else if (session.action === 'unfreeze_wallet' && session.step === 'awaiting_user_id') {
        await this.processUnfreezeWallet(ctx, input);
      } else if (session.action === 'grant_premium' && session.step === 'awaiting_user_id') {
        await this.processGrantPremiumStep1(ctx, input);
      } else if (session.action === 'grant_premium_duration' && session.step === 'awaiting_duration') {
        await this.processGrantPremiumStep2(ctx, session.userId, input);
      } else if (session.action === 'revoke_premium' && session.step === 'awaiting_user_id') {
        await this.processRevokePremium(ctx, input);
      } else if (session.action === 'extend_premium' && session.step === 'awaiting_user_id') {
        await this.processExtendPremiumStep1(ctx, input);
      } else if (session.action === 'extend_premium_duration' && session.step === 'awaiting_duration') {
        await this.processExtendPremiumStep2(ctx, session.userId, input);
      } else if (session.action === 'reject_deposit' && session.step === 'awaiting_reason') {
        await this.processRejectDeposit(ctx, session.transactionId, input);
      } else if (session.action === 'reject_withdrawal' && session.step === 'awaiting_reason') {
        await this.processRejectWithdrawal(ctx, session.transactionId, input);
      } else if (session.action === 'platform_broadcast' && session.step === 'awaiting_message') {
        await this.sendPlatformBroadcast(ctx, input);
      } else if ((session.action === 'ban_user' || session.action === 'unban_user') && session.step === 'awaiting_user_id') {
        await this.processUserBanAction(ctx, session.action, input);
      } else if (session.action === 'toggle_bot' && session.step === 'awaiting_bot_id') {
        await this.processBotToggle(ctx, input);
      } else if (session.action === 'delete_bot' && session.step === 'awaiting_bot_id') {
        await this.processBotDeletion(ctx, input);
      } else {
        console.log(`Unknown admin session step: ${session.action} - ${session.step}`);
        await ctx.reply('❌ Invalid admin session. Please start over.');
        platformAdminSessions.delete(userId);
      }
    } catch (error) {
      console.error('Platform admin input error:', error);
      await ctx.reply(`❌ Error: ${error.message}`, { parse_mode: 'Markdown' });
      platformAdminSessions.delete(ctx.from.id);
    }
  }

  static async processRejectDeposit(ctx, transactionId, reason) {
    try {
      const result = await WalletService.rejectDeposit(transactionId, reason, ctx.from.id);

      await ctx.reply(
        `❌ *Deposit Rejected!*\n\n` +
        `*Transaction ID:* ${result.depositId}\n` +
        `*User ID:* ${result.userId}\n` +
        `*Amount:* ${result.amount.toFixed(2)} BOM\n` +
        `*Reason:* ${reason}\n\n` +
        `User has been notified of the rejection.`,
        { parse_mode: 'Markdown' }
      );

      // Notify user
      try {
        await ctx.telegram.sendMessage(
          result.userId,
          `❌ *Deposit Rejected*\n\n` +
          `Your deposit of ${result.amount.toFixed(2)} BOM has been rejected.\n\n` +
          `*Reason:* ${reason}\n\n` +
          `Please contact support if you have any questions.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      platformAdminSessions.delete(ctx.from.id);
      await this.showPendingDeposits(ctx);
    } catch (error) {
      console.error('Process reject deposit error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  static async processRejectWithdrawal(ctx, transactionId, reason) {
    try {
      const result = await WalletService.rejectWithdrawal(transactionId, reason, ctx.from.id);

      await ctx.reply(
        `❌ *Withdrawal Rejected!*\n\n` +
        `*Transaction ID:* ${result.withdrawalId}\n` +
        `*User ID:* ${result.userId}\n` +
        `*Amount:* ${result.amount.toFixed(2)} BOM\n` +
        `*Reason:* ${reason}\n\n` +
        `The amount has been refunded to the user's wallet.\n` +
        `User has been notified of the rejection.`,
        { parse_mode: 'Markdown' }
      );

      // Notify user
      try {
        await ctx.telegram.sendMessage(
          result.userId,
          `❌ *Withdrawal Rejected*\n\n` +
          `Your withdrawal request has been rejected.\n\n` +
          `*Amount:* ${result.amount.toFixed(2)} BOM\n` +
          `*Reason:* ${reason}\n\n` +
          `The amount has been refunded to your wallet.\n` +
          `Please contact support if you have any questions.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Could not notify user:', notifyError.message);
      }

      platformAdminSessions.delete(ctx.from.id);
      await this.showPendingWithdrawals(ctx);
    } catch (error) {
      console.error('Process reject withdrawal error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  // ==================== EXISTING ACTION PROCESSORS ====================

  static async processUserBanAction(ctx, action, input) {
    try {
      let targetUserId;
      let targetUser;

      if (/^\d+$/.test(input)) {
        targetUserId = parseInt(input);
        targetUser = await User.findOne({ where: { telegram_id: targetUserId } });
      } else {
        const username = input.replace('@', '').trim();
        targetUser = await User.findOne({ where: { username: username } });
        if (targetUser) {
          targetUserId = targetUser.telegram_id;
        }
      }

      if (!targetUser) {
        await ctx.reply('❌ User not found. Please check the User ID or username.');
        return;
      }

      if (action === 'ban_user') {
        if (targetUser.is_banned) {
          await ctx.reply('❌ This user is already banned.');
          return;
        }

        await targetUser.update({
          is_banned: true,
          banned_at: new Date(),
          ban_reason: 'Banned by platform admin'
        });

        const userBots = await Bot.findAll({ where: { owner_id: targetUser.telegram_id } });
        for (const bot of userBots) {
          try {
            await MiniBotManager.stopBot(bot.id);
            await bot.update({ is_active: false });
          } catch (error) {
            console.error(`Failed to stop bot ${bot.id}:`, error);
          }
        }

        const username = targetUser.username ? `@${targetUser.username}` : targetUser.telegram_id;
        await ctx.reply(`✅ User ${username} has been banned and all their bots have been deactivated.`, {
          parse_mode: 'Markdown'
        });

      } else if (action === 'unban_user') {
        if (!targetUser.is_banned) {
          await ctx.reply('❌ This user is not banned.');
          return;
        }

        await targetUser.update({
          is_banned: false,
          banned_at: null,
          ban_reason: null
        });

        const userBots = await Bot.findAll({ where: { owner_id: targetUser.telegram_id } });
        for (const bot of userBots) {
          try {
            await MiniBotManager.initializeBot(bot);
            await bot.update({ is_active: true });
          } catch (error) {
            console.error(`Failed to reactivate bot ${bot.id}:`, error);
          }
        }

        const username = targetUser.username ? `@${targetUser.username}` : targetUser.telegram_id;
        await ctx.reply(`✅ User ${username} has been unbanned and their bots have been reactivated.`, {
          parse_mode: 'Markdown'
        });
      }

      await this.banManagement(ctx);
    } catch (error) {
      console.error('Process user ban action error:', error);
      await ctx.reply('❌ Error processing ban action.');
    }
  }

  static async processBotToggle(ctx, input) {
    try {
      let targetBot;

      if (/^\d+$/.test(input)) {
        const botId = parseInt(input);
        targetBot = await Bot.findByPk(botId);
      } else {
        const botUsername = input.replace('@', '').trim();
        targetBot = await Bot.findOne({ where: { bot_username: botUsername } });
      }

      if (!targetBot) {
        await ctx.reply('❌ Bot not found. Please check the Bot ID or username.');
        return;
      }

      const newStatus = !targetBot.is_active;

      if (newStatus) {
        try {
          const success = await MiniBotManager.initializeBot(targetBot);
          if (success) {
            await targetBot.update({ is_active: true });
            await ctx.reply(`✅ Bot "${targetBot.bot_name}" (@${targetBot.bot_username}) has been activated.`, {
              parse_mode: 'Markdown'
            });
          } else {
            await ctx.reply('❌ Failed to activate bot: Initialization failed. Check bot token.');
            return;
          }
        } catch (error) {
          await ctx.reply(`❌ Failed to activate bot: ${error.message}`);
          return;
        }
      } else {
        try {
          await MiniBotManager.stopBot(targetBot.id);
          await targetBot.update({ is_active: false });
          await ctx.reply(`✅ Bot "${targetBot.bot_name}" (@${targetBot.bot_username}) has been deactivated.`, {
            parse_mode: 'Markdown'
          });
        } catch (error) {
          await ctx.reply(`❌ Failed to deactivate bot: ${error.message}`);
          return;
        }
      }

      await this.botManagement(ctx);
    } catch (error) {
      console.error('Process bot toggle error:', error);
      await ctx.reply('❌ Error toggling bot status.');
    }
  }

  static async processBotDeletion(ctx, input) {
    try {
      let targetBot;

      if (/^\d+$/.test(input)) {
        const botId = parseInt(input);
        targetBot = await Bot.findByPk(botId);
      } else {
        const botUsername = input.replace('@', '').trim();
        targetBot = await Bot.findOne({ where: { bot_username: botUsername } });
      }

      if (!targetBot) {
        await ctx.reply('❌ Bot not found. Please check the Bot ID or username.');
        return;
      }

      try {
        await MiniBotManager.stopBot(targetBot.id);
      } catch (error) {
        console.error('Error stopping bot during deletion:', error);
      }

      console.log(`🗑️ Deleting related records for bot ${targetBot.id}...`);
      
      const adminCount = await Admin.count({ where: { bot_id: targetBot.id } });
      if (adminCount > 0) {
        await Admin.destroy({ where: { bot_id: targetBot.id } });
        console.log(`✅ Deleted ${adminCount} admin records`);
      }
      
      const feedbackCount = await Feedback.count({ where: { bot_id: targetBot.id } });
      if (feedbackCount > 0) {
        await Feedback.destroy({ where: { bot_id: targetBot.id } });
        console.log(`✅ Deleted ${feedbackCount} feedback records`);
      }
      
      const userLogCount = await UserLog.count({ where: { bot_id: targetBot.id } });
      if (userLogCount > 0) {
        await UserLog.destroy({ where: { bot_id: targetBot.id } });
        console.log(`✅ Deleted ${userLogCount} user log records`);
      }
      
      const broadcastCount = await BroadcastHistory.count({ where: { bot_id: targetBot.id } });
      if (broadcastCount > 0) {
        await BroadcastHistory.destroy({ where: { bot_id: targetBot.id } });
        console.log(`✅ Deleted ${broadcastCount} broadcast records`);
      }

      const botName = targetBot.bot_name;
      const botUsername = targetBot.bot_username;
      
      await targetBot.destroy();

      await ctx.reply(`✅ Bot "${botName}" (@${botUsername}) has been permanently deleted along with all its data.`, {
        parse_mode: 'Markdown'
      });

      await this.botManagement(ctx);
    } catch (error) {
      console.error('Process bot deletion error:', error);
      await ctx.reply(`❌ Error deleting bot: ${error.message}`);
    }
  }

  // ==================== UTILITY METHODS ====================

  static async checkUserBan(userId) {
    try {
      const user = await User.findOne({ where: { telegram_id: userId } });
      return user ? user.is_banned : false;
    } catch (error) {
      console.error('Check user ban error:', error);
      return false;
    }
  }

  static isInPlatformAdminSession(userId) {
    return platformAdminSessions.has(userId);
  }

  static getAdminSession(userId) {
    return platformAdminSessions.get(userId);
  }

  static clearAdminSession(userId) {
    platformAdminSessions.delete(userId);
  }
}

// ==================== CALLBACK REGISTRATION ====================

PlatformAdminHandler.registerCallbacks = (bot) => {
  // Dashboard and main navigation
  bot.action('platform_dashboard', async (ctx) => {
    await PlatformAdminHandler.platformDashboard(ctx);
  });

  bot.action('platform_dashboard_refresh', async (ctx) => {
    await PlatformAdminHandler.platformDashboard(ctx);
  });

  bot.action('platform_users', async (ctx) => {
    await PlatformAdminHandler.userManagement(ctx, 1);
  });

  bot.action('platform_bots', async (ctx) => {
    await PlatformAdminHandler.botManagement(ctx, 1);
  });

  // Wallet admin callbacks
  bot.action('platform_wallet_admin', async (ctx) => {
    await PlatformAdminHandler.walletAdminDashboard(ctx);
  });

  bot.action('platform_pending_deposits', async (ctx) => {
    await PlatformAdminHandler.showPendingDeposits(ctx);
  });

  bot.action('platform_pending_withdrawals', async (ctx) => {
    await PlatformAdminHandler.showPendingWithdrawals(ctx);
  });

  bot.action('platform_add_bom', async (ctx) => {
    await PlatformAdminHandler.startAddBOM(ctx);
  });

  bot.action('platform_freeze_wallet', async (ctx) => {
    await PlatformAdminHandler.startFreezeWallet(ctx);
  });

  bot.action('platform_unfreeze_wallet', async (ctx) => {
    await PlatformAdminHandler.startUnfreezeWallet(ctx);
  });

  bot.action('platform_wallet_report', async (ctx) => {
    await PlatformAdminHandler.handleWalletReport(ctx);
  });

  // Subscription admin callbacks
  bot.action('platform_subscription_admin', async (ctx) => {
    await PlatformAdminHandler.subscriptionAdminDashboard(ctx);
  });

  bot.action('platform_grant_premium', async (ctx) => {
    await PlatformAdminHandler.startGrantPremium(ctx);
  });

  bot.action('platform_revoke_premium', async (ctx) => {
    await PlatformAdminHandler.startRevokePremium(ctx);
  });

  bot.action('platform_extend_premium', async (ctx) => {
    await PlatformAdminHandler.startExtendPremium(ctx);
  });

  bot.action('platform_force_renewal', async (ctx) => {
    await PlatformAdminHandler.handleForceRenewalCheck(ctx);
  });

  // Confirm add BOM callback
  bot.action(/platform_confirm_add_bom_(\d+)_([\d\.]+)/, async (ctx) => {
    const userId = parseInt(ctx.match[1]);
    const amount = parseFloat(ctx.match[2]);
    await PlatformAdminHandler.confirmAddBOM(ctx, userId, amount);
  });

  // Deposit approval callbacks
  bot.action(/^approve_deposit_(\d+)$/, async (ctx) => {
    await PlatformAdminHandler.handleApproveDeposit(ctx, ctx.match[1]);
  });

  bot.action(/^reject_deposit_(\d+)$/, async (ctx) => {
    await PlatformAdminHandler.handleRejectDeposit(ctx, ctx.match[1]);
  });

  // Withdrawal approval callbacks
  bot.action(/^approve_withdrawal_(\d+)$/, async (ctx) => {
    await PlatformAdminHandler.handleApproveWithdrawal(ctx, ctx.match[1]);
  });

  bot.action(/^reject_withdrawal_(\d+)$/, async (ctx) => {
    await PlatformAdminHandler.handleRejectWithdrawal(ctx, ctx.match[1]);
  });

  bot.action(/^complete_withdrawal_(\d+)$/, async (ctx) => {
    await PlatformAdminHandler.handleMarkAsCompleted(ctx, ctx.match[1]);
  });

  // Existing callbacks
  bot.action('platform_broadcast', async (ctx) => {
    await PlatformAdminHandler.startPlatformBroadcast(ctx);
  });

  bot.action('platform_bans', async (ctx) => {
    await PlatformAdminHandler.banManagement(ctx);
  });

  bot.action('platform_analytics', async (ctx) => {
    await PlatformAdminHandler.advancedAnalytics(ctx);
  });

  // User management pagination
  bot.action(/platform_users:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await PlatformAdminHandler.userManagement(ctx, page);
  });

  // Bot management pagination
  bot.action(/platform_bots:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await PlatformAdminHandler.botManagement(ctx, page);
  });

  // Ban management actions
  bot.action('platform_ban_user', async (ctx) => {
    await PlatformAdminHandler.startBanUser(ctx);
  });

  bot.action('platform_unban_user', async (ctx) => {
    await PlatformAdminHandler.startUnbanUser(ctx);
  });

  // Analytics and stats
  bot.action('platform_user_stats', async (ctx) => {
    await PlatformAdminHandler.userStatistics(ctx);
  });

  bot.action('platform_detailed_reports', async (ctx) => {
    await PlatformAdminHandler.detailedReports(ctx);
  });

  // Bot management actions
  bot.action('platform_toggle_bot', async (ctx) => {
    await PlatformAdminHandler.startToggleBot(ctx);
  });

  bot.action('platform_delete_bot', async (ctx) => {
    await PlatformAdminHandler.startDeleteBot(ctx);
  });

  // Export features
  bot.action('platform_export_users', async (ctx) => {
    await PlatformAdminHandler.exportUsers(ctx);
  });
};

module.exports = PlatformAdminHandler;