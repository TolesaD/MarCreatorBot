const { Markup } = require('telegraf');
const { Bot, ReferralProgram, Referral, Withdrawal, User, UserLog, ChannelJoin } = require('../models');

class ReferralHandler {
  // Safe reply with HTML
  static async safeReplyWithHTML(ctx, text, extra = {}) {
    try {
      return await ctx.reply(text, { 
        parse_mode: 'HTML',
        ...extra 
      });
    } catch (error) {
      console.error('HTML reply error:', error);
      // Fallback to plain text
      const plainText = text.replace(/<[^>]*>/g, '');
      return await ctx.reply(plainText, extra);
    }
  }

  // Safe edit message with HTML
  static async safeEditMessageWithHTML(ctx, text, extra = {}) {
    try {
      if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.message) {
        return await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          ...extra
        });
      }
      return null;
    } catch (error) {
      console.error('HTML edit message error:', error);
      // Fallback to plain text
      const plainText = text.replace(/<[^>]*>/g, '');
      if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.message) {
        return await ctx.editMessageText(plainText, extra);
      }
      return null;
    }
  }

  // Auto-setup referral program for bot
  static async setupReferralProgram(botId) {
    try {
      const [program] = await ReferralProgram.findOrCreate({
        where: { bot_id: botId },
        defaults: {
          is_enabled: false,
          referral_rate: 1.00,
          min_withdrawal: 10.00,
          currency: 'USD',
          required_channels: []
        }
      });
      return program;
    } catch (error) {
      console.error('Setup referral program error:', error);
      return null;
    }
  }

  // Add this method to your ReferralHandler.js file
static async processCurrencySetting(ctx, botId, input) {
  try {
    const session = this.referralSessions?.get(ctx.from.id);
    if (!session || session.botId != botId) {
      return false;
    }

    if (input === '/cancel') {
      this.referralSessions.delete(ctx.from.id);
      await ctx.reply('❌ Currency setting cancelled.');
      return true;
    }

    const newCurrency = input.toUpperCase().trim();
    if (newCurrency.length < 3 || newCurrency.length > 5 || !/^[A-Z]+$/.test(newCurrency)) {
      await ctx.reply('❌ Invalid currency code. Please enter 3-5 uppercase letters (e.g., USD, EUR, BTC).');
      return true;
    }

    const program = await ReferralProgram.findOne({ where: { bot_id: botId } });
    await program.update({ currency: newCurrency });

    await ctx.reply(`✅ Currency updated to ${newCurrency}!`);
    this.referralSessions.delete(ctx.from.id);
    
    return true;

  } catch (error) {
    console.error('Process currency setting error:', error);
    await ctx.reply('❌ Error processing currency setting.');
    this.referralSessions?.delete(ctx.from.id);
    return false;
  }
}
  // Generate unique referral code
  static generateReferralCode(userId, botId) {
    const timestamp = Date.now().toString(36);
    return `REF_${botId}_${userId}_${timestamp}`.toUpperCase();
  }

  // Handle referral settings
  static async handleReferralSettings(ctx, botId) {
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('⚙️ Loading settings...');
      }
      
      let program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      if (!program) {
        program = await this.setupReferralProgram(botId);
      }

      const message = `⚙️ <b>Referral Program Settings</b>\n\n` +
        `<b>Current Settings:</b>\n` +
        `💰 Referral Rate: ${program.currency} ${program.referral_rate}\n` +
        `💵 Min Withdrawal: ${program.currency} ${program.min_withdrawal}\n` +
        `💱 Currency: ${program.currency}\n\n` +
        `<b>Available Actions:</b>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💰 Change Referral Rate', `ref_change_rate_${botId}`)],
        [Markup.button.callback('💵 Change Min Withdrawal', `ref_change_min_${botId}`)],
        [Markup.button.callback('💱 Change Currency', `ref_change_currency_${botId}`)],
        [Markup.button.callback('🔄 Reset to Default', `ref_reset_settings_${botId}`)],
        [Markup.button.callback('🔙 Back to Management', `ref_manage_${botId}`)]
      ]);

      await this.safeEditMessageWithHTML(ctx, message, keyboard);

    } catch (error) {
      console.error('Handle referral settings error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading settings');
      }
    }
  }

  // Change referral rate
  static async startChangeReferralRate(ctx, botId) {
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery();
      }
      
      this.referralSessions = this.referralSessions || new Map();
      this.referralSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_referral_rate',
        timestamp: Date.now()
      });

      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });

      await this.safeReplyWithHTML(
        ctx,
        `💰 <b>Change Referral Rate</b>\n\n` +
        `Current rate: ${program.currency} ${program.referral_rate}\n\n` +
        `Please enter the new referral rate (amount per successful referral):\n\n` +
        `<b>Examples:</b>\n` +
        `• 1.50 (for ${program.currency} 1.50 per referral)\n` +
        `• 2.00 (for ${program.currency} 2.00 per referral)\n\n` +
        `<b>Cancel:</b> Type /cancel`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚫 Cancel', `ref_settings_${botId}`)]
        ])
      );

    } catch (error) {
      console.error('Start change referral rate error:', error);
      await ctx.reply('❌ Error starting rate change.');
    }
  }

  // Change minimum withdrawal
  static async startChangeMinWithdrawal(ctx, botId) {
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery();
      }
      
      this.referralSessions = this.referralSessions || new Map();
      this.referralSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_min_withdrawal',
        timestamp: Date.now()
      });

      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });

      await this.safeReplyWithHTML(
        ctx,
        `💵 <b>Change Minimum Withdrawal</b>\n\n` +
        `Current minimum: ${program.currency} ${program.min_withdrawal}\n\n` +
        `Please enter the new minimum withdrawal amount:\n\n` +
        `<b>Examples:</b>\n` +
        `• 10.00 (for ${program.currency} 10.00 minimum)\n` +
        `• 25.00 (for ${program.currency} 25.00 minimum)\n\n` +
        `<b>Cancel:</b> Type /cancel`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚫 Cancel', `ref_settings_${botId}`)]
        ])
      );

    } catch (error) {
      console.error('Start change min withdrawal error:', error);
      await ctx.reply('❌ Error starting withdrawal change.');
    }
  }

  // Change currency
  static async startChangeCurrency(ctx, botId) {
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery();
      }
      
      this.referralSessions = this.referralSessions || new Map();
      this.referralSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_currency',
        timestamp: Date.now()
      });

      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      const availableCurrencies = ['USD', 'ETB', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED'];

      let message = `💱 <b>Change Currency</b>\n\n` +
        `Current currency: ${program.currency}\n\n` +
        `Please select your preferred currency:\n\n`;

      availableCurrencies.forEach((currency, index) => {
        message += `${index + 1}. ${currency}\n`;
      });

      message += `\n<b>Or type your custom currency code (3 letters):</b>\n\n` +
        `<b>Cancel:</b> Type /cancel`;

      const currencyButtons = [];
      for (let i = 0; i < availableCurrencies.length; i += 2) {
        const row = [
          Markup.button.callback(availableCurrencies[i], `ref_set_currency_${botId}_${availableCurrencies[i]}`),
          ...(availableCurrencies[i + 1] ? [Markup.button.callback(availableCurrencies[i + 1], `ref_set_currency_${botId}_${availableCurrencies[i + 1]}`)] : [])
        ];
        currencyButtons.push(row);
      }

      currencyButtons.push([
        Markup.button.callback('🚫 Cancel', `ref_settings_${botId}`)
      ]);

      const keyboard = Markup.inlineKeyboard(currencyButtons);

      await this.safeReplyWithHTML(ctx, message, keyboard);

    } catch (error) {
      console.error('Start change currency error:', error);
      await ctx.reply('❌ Error starting currency change.');
    }
  }

  // Handle currency selection
  static async handleCurrencySelection(ctx, botId, currency) {
    try {
      await ctx.answerCbQuery(`✅ Setting currency to ${currency}`);
      
      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      await program.update({ currency: currency });
      
      this.referralSessions?.delete(ctx.from.id);
      
      await ctx.reply(`✅ Currency updated to ${currency}!`);
      await this.handleReferralSettings(ctx, botId);
      
    } catch (error) {
      console.error('Handle currency selection error:', error);
      await ctx.answerCbQuery('❌ Error setting currency');
    }
  }

  // Process referral settings changes from text input
  static async processReferralSettingChange(ctx, botId, input) {
    try {
      // Clean up expired sessions first
      this.cleanupExpiredSessions();

      const session = this.referralSessions?.get(ctx.from.id);
      if (!session) {
        return false;
      }

      if (session.botId != botId) {
        this.referralSessions.delete(ctx.from.id);
        return false;
      }

      // Check if session is expired (30 minutes)
      if (Date.now() - session.timestamp > 30 * 60 * 1000) {
        this.referralSessions.delete(ctx.from.id);
        await ctx.reply('❌ Session expired. Please start over.');
        return false;
      }

      if (input === '/cancel') {
        this.referralSessions.delete(ctx.from.id);
        await ctx.reply('❌ Settings change cancelled.');
        await this.handleReferralSettings(ctx, botId);
        return true;
      }

      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      
      if (session.step === 'awaiting_referral_rate') {
        const newRate = parseFloat(input);
        if (isNaN(newRate) || newRate <= 0) {
          await ctx.reply('❌ Invalid amount. Please enter a valid number greater than 0.');
          return true;
        }

        await program.update({ referral_rate: newRate });
        await ctx.reply(`✅ Referral rate updated to ${program.currency} ${newRate.toFixed(2)} per referral!`);
        this.referralSessions.delete(ctx.from.id);
        await this.handleReferralSettings(ctx, botId);
        return true;
      }

      if (session.step === 'awaiting_min_withdrawal') {
        const newMin = parseFloat(input);
        if (isNaN(newMin) || newMin <= 0) {
          await ctx.reply('❌ Invalid amount. Please enter a valid number greater than 0.');
          return true;
        }

        await program.update({ min_withdrawal: newMin });
        await ctx.reply(`✅ Minimum withdrawal updated to ${program.currency} ${newMin.toFixed(2)}!`);
        this.referralSessions.delete(ctx.from.id);
        await this.handleReferralSettings(ctx, botId);
        return true;
      }

      if (session.step === 'awaiting_currency') {
        const newCurrency = input.toUpperCase().trim();
        if (newCurrency.length !== 3 || !/^[A-Z]{3}$/.test(newCurrency)) {
          await ctx.reply('❌ Invalid currency code. Please enter a 3-letter currency code (e.g., USD, EUR, ETB).');
          return true;
        }

        await program.update({ currency: newCurrency });
        await ctx.reply(`✅ Currency updated to ${newCurrency}!`);
        this.referralSessions.delete(ctx.from.id);
        await this.handleReferralSettings(ctx, botId);
        return true;
      }

      this.referralSessions.delete(ctx.from.id);
      return false;

    } catch (error) {
      console.error('Process referral setting change error:', error);
      await ctx.reply('❌ Error processing setting change.');
      this.referralSessions?.delete(ctx.from.id);
      return false;
    }
  }

  // Reset settings to default
  static async resetReferralSettings(ctx, botId) {
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('🔄 Resetting settings...');
      }
      
      await ReferralProgram.update({
        referral_rate: 1.00,
        min_withdrawal: 10.00,
        currency: 'USD'
      }, { where: { bot_id: botId } });

      await ctx.reply('✅ Referral settings reset to default values!');
      await this.handleReferralSettings(ctx, botId);

    } catch (error) {
      console.error('Reset referral settings error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error resetting settings');
      }
    }
  }

  // Handle referral stats
  static async handleReferralStats(ctx, botId) {
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('📊 Loading stats...');
      }
      
      const stats = await this.getProgramStats(botId);
      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });

      const message = `📊 <b>Referral Program Statistics</b>\n\n` +
        `<b>Overall Stats:</b>\n` +
        `• Total Referrals: ${stats.totalReferrals}\n` +
        `• Completed Referrals: ${stats.completedReferrals}\n` +
        `• Total Paid Out: ${program.currency} ${stats.totalPaid.toFixed(2)}\n` +
        `• Pending Withdrawals: ${program.currency} ${stats.pendingWithdrawals.toFixed(2)}\n\n` +
        `<b>Conversion Rate:</b> ${stats.totalReferrals > 0 ? ((stats.completedReferrals / stats.totalReferrals) * 100).toFixed(1) : 0}%`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back', `ref_manage_${botId}`)]
      ]);

      if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.message) {
        await this.safeEditMessageWithHTML(ctx, message, keyboard);
      } else {
        await this.safeReplyWithHTML(ctx, message, keyboard);
      }

    } catch (error) {
      console.error('Handle referral stats error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading stats');
      }
    }
  }

  // Handle withdrawal requests view
  static async handleWithdrawalRequests(ctx, botId) {
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('💳 Loading withdrawals...');
      }
      
      const withdrawals = await Withdrawal.findAll({
        where: { bot_id: botId },
        include: [{
          model: require('../models/User'),
          as: 'User',
          attributes: ['username', 'first_name']
        }],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
      const processingWithdrawals = withdrawals.filter(w => w.status === 'processing');

      let message = `💳 <b>Withdrawal Requests</b>\n\n` +
        `<b>Summary:</b>\n` +
        `• Pending: ${pendingWithdrawals.length}\n` +
        `• Processing: ${processingWithdrawals.length}\n\n`;

      if (withdrawals.length === 0) {
        message += `No withdrawal requests found.`;
      } else {
        message += `<b>Recent Requests:</b>\n`;
        withdrawals.slice(0, 5).forEach((withdrawal, index) => {
          const userInfo = withdrawal.User?.username ? 
            `@${withdrawal.User.username}` : 
            withdrawal.User?.first_name || `User#${withdrawal.user_id}`;
          
          message += `${index + 1}. ${userInfo} - ${withdrawal.currency} ${withdrawal.amount} (${withdrawal.status})\n`;
        });
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back', `ref_manage_${botId}`)]
      ]);

      if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.message) {
        await this.safeEditMessageWithHTML(ctx, message, keyboard);
      } else {
        await this.safeReplyWithHTML(ctx, message, keyboard);
      }

    } catch (error) {
      console.error('Handle withdrawal requests error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading withdrawals');
      }
    }
  }

  // Handle share referral link
  static async handleShareReferral(ctx, botId) {
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('📤 Sharing referral link...');
      }
      
      const referralCode = this.generateReferralCode(ctx.from.id, botId);
      const shareText = `Join me on this amazing bot and earn rewards! Use my referral link:\n\n` +
        `https://t.me/${ctx.metaBotInfo?.botUsername}?start=ref-${referralCode}`;

      await this.safeReplyWithHTML(
        ctx,
        `📤 <b>Share Your Referral Link</b>\n\n` +
        `Copy and share this link with your friends:\n\n` +
        `<code>${shareText}</code>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Back', `ref_dashboard_${botId}`)]
        ])
      );

    } catch (error) {
      console.error('Handle share referral error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error sharing link');
      }
    }
  }

  // Get user referral stats - FIXED: Properly calculate current balance
  static async getUserReferralStats(botId, userId) {
    try {
      const [totalReferrals, completedReferrals, totalEarnings, pendingWithdrawals, completedWithdrawals] = await Promise.all([
        Referral.count({
          where: { 
            bot_id: botId, 
            referrer_id: userId 
          }
        }),
        Referral.count({
          where: { 
            bot_id: botId, 
            referrer_id: userId,
            is_completed: true
          }
        }),
        Referral.sum('amount_earned', {
          where: { 
            bot_id: botId, 
            referrer_id: userId,
            is_completed: true
          }
        }),
        Withdrawal.sum('amount', {
          where: { 
            bot_id: botId, 
            user_id: userId,
            status: ['pending', 'processing']
          }
        }),
        Withdrawal.sum('amount', {
          where: { 
            bot_id: botId, 
            user_id: userId,
            status: 'completed'
          }
        })
      ]);

      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      
      // FIXED: Calculate current balance correctly
      // Current balance = Total earnings - (Pending withdrawals + Completed withdrawals)
      const totalWithdrawn = (pendingWithdrawals || 0) + (completedWithdrawals || 0);
      const currentBalance = (totalEarnings || 0) - totalWithdrawn;

      return {
        totalReferrals: totalReferrals || 0,
        completedReferrals: completedReferrals || 0,
        totalEarnings: totalEarnings || 0,
        currentBalance: currentBalance > 0 ? currentBalance : 0,
        totalWithdrawn: totalWithdrawn || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
        referralRate: program?.referral_rate || 1.00,
        minWithdrawal: program?.min_withdrawal || 10.00,
        currency: program?.currency || 'USD'
      };

    } catch (error) {
      console.error('Get user referral stats error:', error);
      return {
        totalReferrals: 0,
        completedReferrals: 0,
        totalEarnings: 0,
        currentBalance: 0,
        totalWithdrawn: 0,
        pendingWithdrawals: 0,
        referralRate: 1.00,
        minWithdrawal: 10.00,
        currency: 'USD'
      };
    }
  }

  // Show referral dashboard to users - FIXED: Show updated balance
  static async showReferralDashboard(ctx, botId) {
    try {
      let program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      
      if (!program) {
        program = await this.setupReferralProgram(botId);
      }
      
      if (!program || !program.is_enabled) {
        await ctx.reply(
          '❌ Referral program is not currently active.\n\n' +
          'Please check back later or contact the bot owner.',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back', 'back_to_bot')]
          ])
        );
        return;
      }

      const stats = await this.getUserReferralStats(botId, ctx.from.id);
      const referralCode = this.generateReferralCode(ctx.from.id, botId);

      const message = `💰 <b>Referral Program</b>\n\n` +
        `Invite friends and earn ${program.currency} ${program.referral_rate} for each successful referral!\n\n` +
        `<b>Your Stats:</b>\n` +
        `• Total Referrals: ${stats.totalReferrals}\n` +
        `• Completed: ${stats.completedReferrals}\n` +
        `• Total Earnings: ${program.currency} ${stats.totalEarnings.toFixed(2)}\n` +
        `• Total Withdrawn: ${program.currency} ${stats.totalWithdrawn.toFixed(2)}\n` +
        `• Pending Withdrawals: ${program.currency} ${stats.pendingWithdrawals.toFixed(2)}\n` +
        `• <b>Current Balance: ${program.currency} ${stats.currentBalance.toFixed(2)}</b>\n\n` +
        `<b>Quick Actions:</b>\n` +
        `• Share your referral link\n` +
        `• Track your referrals in real-time\n` +
        `• Withdraw when you reach ${program.currency} ${program.min_withdrawal}\n\n` +
        `<b>Your Referral Link:</b>\n` +
        `https://t.me/${ctx.metaBotInfo?.botUsername}?start=ref-${referralCode}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Share Referral Link', `share_ref_${botId}`)],
        [Markup.button.callback('👥 My Referrals', `my_referees_${botId}`)],
        [Markup.button.callback('💳 Withdraw Earnings', `withdraw_${botId}`)],
        [Markup.button.callback('🔄 Refresh', `ref_dashboard_${botId}`)],
        [Markup.button.callback('🔙 Back to Bot', 'back_to_bot')]
      ]);

      if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.message) {
        await this.safeEditMessageWithHTML(ctx, message, keyboard);
      } else {
        await this.safeReplyWithHTML(ctx, message, keyboard);
      }

    } catch (error) {
      console.error('Show referral dashboard error:', error);
      await ctx.reply('❌ Error loading referral program.');
    }
  }

  // Handle referral start parameter
  static async handleReferralStart(ctx, referralCode) {
    try {
      const { metaBotInfo } = ctx;
      if (!metaBotInfo) {
        return;
      }

      let program = await ReferralProgram.findOne({ 
        where: { bot_id: metaBotInfo.mainBotId } 
      });
      
      if (!program) {
        program = await this.setupReferralProgram(metaBotInfo.mainBotId);
      }
      
      if (!program || !program.is_enabled) {
        return;
      }

      // Parse referral code with new format REF_botId_userId_timestamp
      const parts = referralCode.split('_');
      if (parts.length !== 4 || parts[0] !== 'REF') {
        return;
      }

      const [, botId, referrerId, timestamp] = parts;
      
      if (parseInt(botId) !== parseInt(metaBotInfo.mainBotId)) {
        return;
      }

      const referrerUserId = parseInt(referrerId);
      
      // Check if user is referring themselves
      if (ctx.from.id === referrerUserId) {
        return;
      }

      // Check if this user was already referred
      const existingReferral = await Referral.findOne({
        where: { 
          bot_id: metaBotInfo.mainBotId,
          referred_id: ctx.from.id
        }
      });

      if (existingReferral) {
        return;
      }

      // Check if referrer exists in our database
      const referrer = await User.findOne({ 
        where: { telegram_id: referrerUserId } 
      });
      
      if (!referrer) {
        return;
      }

      // Create the referral record
      await Referral.create({
        bot_id: metaBotInfo.mainBotId,
        referrer_id: referrerUserId,
        referred_id: ctx.from.id,
        referral_code: referralCode,
        amount_earned: program.referral_rate,
        is_completed: true,
        completed_at: new Date()
      });

      // Notify the referrer
      await this.notifyReferrerAboutNewReferral(metaBotInfo.mainBotId, referrerUserId, ctx.from.id, program);

      // Log user interaction
      await UserLog.upsert({
        bot_id: metaBotInfo.mainBotId,
        user_id: ctx.from.id,
        user_username: ctx.from.username,
        user_first_name: ctx.from.first_name,
        last_interaction: new Date(),
        first_interaction: new Date(),
        interaction_count: 1
      });

    } catch (error) {
      console.error('❌ Handle referral start error:', error);
    }
  }

  // Notify referrer about new referral
  static async notifyReferrerAboutNewReferral(botId, referrerId, referredUserId, program) {
    try {
      const botInstance = require('../services/MiniBotManager').getBotInstanceByDbId(botId);
      
      if (!botInstance) {
        return;
      }

      // Get referrer's stats to show updated balance
      const stats = await this.getUserReferralStats(botId, referrerId);

      const message = `🎉 <b>New Referral Completed!</b>\n\n` +
        `Someone joined using your referral link!\n\n` +
        `<b>You earned:</b> ${program.currency} ${program.referral_rate}\n` +
        `<b>Total Referrals:</b> ${stats.totalReferrals}\n` +
        `<b>Total Earnings:</b> ${program.currency} ${stats.totalEarnings.toFixed(2)}\n` +
        `<b>Current Balance:</b> ${program.currency} ${stats.currentBalance.toFixed(2)}\n\n` +
        `Keep sharing your link to earn more! 🚀`;

      await botInstance.telegram.sendMessage(
        referrerId,
        message,
        { 
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 View My Dashboard', `ref_dashboard_${botId}`)]
          ])
        }
      );

    } catch (error) {
      console.error('❌ Failed to notify referrer:', error.message);
    }
  }

  // Show user's referrals
  static async showUserReferrals(ctx, botId) {
    try {
      const referrals = await Referral.findAll({
        where: { 
          bot_id: botId, 
          referrer_id: ctx.from.id 
        },
        include: [{
          model: User,
          as: 'ReferredUser',
          attributes: ['username', 'first_name']
        }],
        order: [['created_at', 'DESC']],
        limit: 20
      });

      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      const stats = await this.getUserReferralStats(botId, ctx.from.id);

      let message = `👥 <b>Your Referrals</b>\n\n` +
        `<b>Summary:</b>\n` +
        `• Total: ${stats.totalReferrals}\n` +
        `• Completed: ${stats.completedReferrals}\n` +
        `• Earnings: ${program.currency} ${stats.totalEarnings.toFixed(2)}\n` +
        `• Withdrawn: ${program.currency} ${stats.totalWithdrawn.toFixed(2)}\n` +
        `• <b>Current Balance: ${program.currency} ${stats.currentBalance.toFixed(2)}</b>\n\n`;

      if (referrals.length === 0) {
        message += `No referrals yet. Share your link to start earning! 💰`;
      } else {
        message += `<b>Recent Referrals:</b>\n`;
        referrals.forEach((ref, index) => {
          const userInfo = ref.ReferredUser?.username ? 
            `@${ref.ReferredUser.username}` : 
            ref.ReferredUser?.first_name || `User#${ref.referred_id}`;
          
          const status = ref.is_completed ? '✅' : '⏳';
          const amount = ref.is_completed ? `${program.currency} ${ref.amount_earned}` : 'Pending';
          
          message += `${index + 1}. ${userInfo} ${status} ${amount}\n`;
        });
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Share Link', `share_ref_${botId}`)],
        [Markup.button.callback('💰 Withdraw', `withdraw_${botId}`)],
        [Markup.button.callback('🔙 Dashboard', `ref_dashboard_${botId}`)]
      ]);

      if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.message) {
        await this.safeEditMessageWithHTML(ctx, message, keyboard);
      } else {
        await this.safeReplyWithHTML(ctx, message, keyboard);
      }

    } catch (error) {
      console.error('Show user referrals error:', error);
      await ctx.reply('❌ Error loading referrals.');
    }
  }

  // Handle withdrawal request
  static async handleWithdrawal(ctx, botId) {
    try {
      const stats = await this.getUserReferralStats(botId, ctx.from.id);
      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });

      if (stats.currentBalance < program.min_withdrawal) {
        await this.safeReplyWithHTML(
          ctx,
          `❌ <b>Withdrawal Not Available</b>\n\n` +
          `Minimum withdrawal amount: ${program.currency} ${program.min_withdrawal}\n` +
          `Your current balance: ${program.currency} ${stats.currentBalance.toFixed(2)}\n\n` +
          `You need ${program.currency} ${(program.min_withdrawal - stats.currentBalance).toFixed(2)} more to withdraw.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('📤 Share to Earn More', `share_ref_${botId}`)],
            [Markup.button.callback('🔙 Back', `ref_dashboard_${botId}`)]
          ])
        );
        return;
      }

      // Start withdrawal session
      this.withdrawalSessions = this.withdrawalSessions || new Map();
      this.withdrawalSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_withdrawal_amount',
        maxAmount: stats.currentBalance,
        timestamp: Date.now()
      });

      await this.safeReplyWithHTML(
        ctx,
        `💳 <b>Withdrawal Request</b>\n\n` +
        `<b>Available Balance:</b> ${program.currency} ${stats.currentBalance.toFixed(2)}\n` +
        `<b>Minimum Withdrawal:</b> ${program.currency} ${program.min_withdrawal}\n\n` +
        `Please enter the amount you want to withdraw:\n\n` +
        `<b>Examples:</b>\n` +
        `• ${stats.currentBalance.toFixed(2)} (full amount)\n` +
        `• 15.00 (specific amount)\n\n` +
        `<b>Cancel:</b> Type /cancel`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚫 Cancel', `ref_dashboard_${botId}`)]
        ])
      );

    } catch (error) {
      console.error('Handle withdrawal error:', error);
      await ctx.reply('❌ Error processing withdrawal.');
    }
  }

  // Process withdrawal amount
  static async processWithdrawalAmount(ctx, botId, input) {
    try {
      // Clean up expired sessions first (older than 30 minutes)
      this.cleanupExpiredSessions();

      const session = this.withdrawalSessions?.get(ctx.from.id);
      if (!session) {
        await ctx.reply('❌ No active withdrawal session found. Please start a new withdrawal request.');
        return false;
      }

      if (session.botId != botId) {
        this.withdrawalSessions.delete(ctx.from.id);
        await ctx.reply('❌ Session mismatch. Please start a new withdrawal request.');
        return false;
      }

      // Check if session is expired (30 minutes)
      if (Date.now() - session.timestamp > 30 * 60 * 1000) {
        this.withdrawalSessions.delete(ctx.from.id);
        await ctx.reply('❌ Withdrawal session expired. Please start a new request.');
        return false;
      }

      if (input === '/cancel') {
        this.withdrawalSessions.delete(ctx.from.id);
        await ctx.reply('❌ Withdrawal cancelled.');
        await this.showReferralDashboard(ctx, botId);
        return true;
      }

      const amount = parseFloat(input);
      const program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Please enter a valid number greater than 0.');
        return true;
      }

      if (amount < program.min_withdrawal) {
        await ctx.reply(`❌ Amount is below minimum withdrawal of ${program.currency} ${program.min_withdrawal}.`);
        return true;
      }

      if (amount > session.maxAmount) {
        await ctx.reply(`❌ Amount exceeds your available balance of ${program.currency} ${session.maxAmount.toFixed(2)}.`);
        return true;
      }

      // Create withdrawal request
      const withdrawal = await Withdrawal.create({
        bot_id: botId,
        user_id: ctx.from.id,
        amount: amount,
        currency: program.currency,
        status: 'pending',
        payment_method: 'manual',
        payment_details: 'Pending admin approval'
      });

      // Clear session
      this.withdrawalSessions.delete(ctx.from.id);

      // Notify user
      await this.safeReplyWithHTML(
        ctx,
        `✅ <b>Withdrawal Request Submitted!</b>\n\n` +
        `<b>Amount:</b> ${program.currency} ${amount.toFixed(2)}\n` +
        `<b>Status:</b> Pending Approval\n\n` +
        `Your withdrawal request has been sent to the bot owner for manual processing. The owner will contact you to arrange payment.\n\n` +
        `You will be notified when your request is approved.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Back to Dashboard', `ref_dashboard_${botId}`)]
        ])
      );

      // Notify bot owner about the withdrawal request
      await this.notifyOwnerAboutWithdrawal(botId, withdrawal, ctx.from);

      return true;

    } catch (error) {
      console.error('Process withdrawal amount error:', error);
      await ctx.reply('❌ Error processing withdrawal amount.');
      this.withdrawalSessions?.delete(ctx.from.id);
      return false;
    }
  }

  // NEW METHOD: Clean up expired sessions
  static cleanupExpiredSessions() {
    const now = Date.now();
    const expirationTime = 30 * 60 * 1000; // 30 minutes
    
    if (this.withdrawalSessions) {
      for (const [userId, session] of this.withdrawalSessions.entries()) {
        if (now - session.timestamp > expirationTime) {
          this.withdrawalSessions.delete(userId);
        }
      }
    }
    
    if (this.referralSessions) {
      for (const [userId, session] of this.referralSessions.entries()) {
        if (now - session.timestamp > expirationTime) {
          this.referralSessions.delete(userId);
        }
      }
    }
  }

  // Notify bot owner about withdrawal request - FIXED: Better button management
  static async notifyOwnerAboutWithdrawal(botId, withdrawal, user) {
    try {
      const botInstance = require('../services/MiniBotManager').getBotInstanceByDbId(botId);
      if (!botInstance) {
        return;
      }

      // Get bot owner
      const bot = await Bot.findByPk(botId);
      if (!bot) {
        return;
      }

      const userInfo = user.username ? `@${user.username}` : `${user.first_name} (ID: ${user.id})`;

      const message = `💳 <b>New Withdrawal Request</b>\n\n` +
        `<b>User:</b> ${userInfo}\n` +
        `<b>Amount:</b> ${withdrawal.currency} ${withdrawal.amount}\n` +
        `<b>Request ID:</b> ${withdrawal.id}\n\n` +
        `Please contact the user to arrange payment manually.\n\n` +
        `Once payment is sent, use the button below to approve the withdrawal.`;

      // FIXED: Better button layout with back button
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Approve', `approve_withdrawal_${withdrawal.id}`),
          Markup.button.callback('❌ Reject', `reject_withdrawal_${withdrawal.id}`)
        ],
        [Markup.button.callback('📋 View All Requests', `ref_withdrawals_${botId}`)],
        [Markup.button.callback('🔙 Back to Management', `ref_manage_${botId}`)]
      ]);

      await botInstance.telegram.sendMessage(
        bot.owner_id,
        message,
        {
          parse_mode: 'HTML',
          ...keyboard
        }
      );

    } catch (error) {
      console.error('Notify owner about withdrawal error:', error);
    }
  }

  // Approve withdrawal - FIXED: Update buttons after approval
  static async approveWithdrawal(ctx, withdrawalId) {
    try {
      const withdrawal = await Withdrawal.findByPk(withdrawalId);
      if (!withdrawal) {
        await ctx.answerCbQuery('❌ Withdrawal not found');
        return;
      }

      // Check if already processed
      if (withdrawal.status !== 'pending') {
        await ctx.answerCbQuery(`❌ Withdrawal already ${withdrawal.status}`);
        return;
      }

      await withdrawal.update({
        status: 'completed',
        processed_at: new Date(),
        processed_by: ctx.from.id
      });

      await ctx.answerCbQuery('✅ Withdrawal approved');

      // FIXED: Update the message to show it's approved and remove buttons
      const userInfo = withdrawal.User?.username ? 
        `@${withdrawal.User.username}` : 
        withdrawal.User?.first_name || `User#${withdrawal.user_id}`;

      const approvedMessage = `✅ <b>Withdrawal Approved</b>\n\n` +
        `<b>User:</b> ${userInfo}\n` +
        `<b>Amount:</b> ${withdrawal.currency} ${withdrawal.amount}\n` +
        `<b>Request ID:</b> ${withdrawal.id}\n` +
        `<b>Approved by:</b> ${ctx.from.first_name}\n` +
        `<b>Approved at:</b> ${new Date().toLocaleString()}\n\n` +
        `This withdrawal has been successfully processed.`;

      try {
        await ctx.editMessageText(approvedMessage, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 View All Requests', `ref_withdrawals_${withdrawal.bot_id}`)],
            [Markup.button.callback('🔙 Back to Management', `ref_manage_${withdrawal.bot_id}`)]
          ])
        });
      } catch (editError) {
        console.log('Message edit not possible, sending new message');
        await ctx.reply(approvedMessage, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 View All Requests', `ref_withdrawals_${withdrawal.bot_id}`)],
            [Markup.button.callback('🔙 Back to Management', `ref_manage_${withdrawal.bot_id}`)]
          ])
        });
      }

      // Notify user about approval
      await this.notifyUserAboutWithdrawalStatus(withdrawal, 'approved');

    } catch (error) {
      console.error('Approve withdrawal error:', error);
      await ctx.answerCbQuery('❌ Error approving withdrawal');
    }
  }

  // Reject withdrawal - FIXED: Update buttons after rejection
  static async rejectWithdrawal(ctx, withdrawalId) {
    try {
      const withdrawal = await Withdrawal.findByPk(withdrawalId);
      if (!withdrawal) {
        await ctx.answerCbQuery('❌ Withdrawal not found');
        return;
      }

      // Check if already processed
      if (withdrawal.status !== 'pending') {
        await ctx.answerCbQuery(`❌ Withdrawal already ${withdrawal.status}`);
        return;
      }

      await withdrawal.update({
        status: 'rejected',
        processed_at: new Date(),
        processed_by: ctx.from.id
      });

      await ctx.answerCbQuery('❌ Withdrawal rejected');

      // FIXED: Update the message to show it's rejected and remove buttons
      const userInfo = withdrawal.User?.username ? 
        `@${withdrawal.User.username}` : 
        withdrawal.User?.first_name || `User#${withdrawal.user_id}`;

      const rejectedMessage = `❌ <b>Withdrawal Rejected</b>\n\n` +
        `<b>User:</b> ${userInfo}\n` +
        `<b>Amount:</b> ${withdrawal.currency} ${withdrawal.amount}\n` +
        `<b>Request ID:</b> ${withdrawal.id}\n` +
        `<b>Rejected by:</b> ${ctx.from.first_name}\n` +
        `<b>Rejected at:</b> ${new Date().toLocaleString()}\n\n` +
        `This withdrawal request has been rejected.`;

      try {
        await ctx.editMessageText(rejectedMessage, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 View All Requests', `ref_withdrawals_${withdrawal.bot_id}`)],
            [Markup.button.callback('🔙 Back to Management', `ref_manage_${withdrawal.bot_id}`)]
          ])
        });
      } catch (editError) {
        console.log('Message edit not possible, sending new message');
        await ctx.reply(rejectedMessage, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 View All Requests', `ref_withdrawals_${withdrawal.bot_id}`)],
            [Markup.button.callback('🔙 Back to Management', `ref_manage_${withdrawal.bot_id}`)]
          ])
        });
      }

      // Notify user about rejection
      await this.notifyUserAboutWithdrawalStatus(withdrawal, 'rejected');

    } catch (error) {
      console.error('Reject withdrawal error:', error);
      await ctx.answerCbQuery('❌ Error rejecting withdrawal');
    }
  }

  // Notify user about withdrawal status
  static async notifyUserAboutWithdrawalStatus(withdrawal, status) {
    try {
      const botInstance = require('../services/MiniBotManager').getBotInstanceByDbId(withdrawal.bot_id);
      if (!botInstance) {
        return;
      }

      let message;
      if (status === 'approved') {
        message = `✅ <b>Withdrawal Approved!</b>\n\n` +
          `<b>Amount:</b> ${withdrawal.currency} ${withdrawal.amount}\n` +
          `<b>Status:</b> Completed\n\n` +
          `Your withdrawal has been processed successfully. Thank you for using our referral program! 🎉`;
      } else {
        message = `❌ <b>Withdrawal Rejected</b>\n\n` +
          `<b>Amount:</b> ${withdrawal.currency} ${withdrawal.amount}\n` +
          `<b>Status:</b> Rejected\n\n` +
          `Please contact the bot owner for more information.`;
      }

      await botInstance.telegram.sendMessage(
        withdrawal.user_id,
        message,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 View Dashboard', `ref_dashboard_${withdrawal.bot_id}`)]
          ])
        }
      );

    } catch (error) {
      console.error('Notify user about withdrawal status error:', error);
    }
  }

  // Admin: Show referral program management - FIXED: Show updated stats
  static async showReferralManagement(ctx, botId) {
    try {
      let program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      
      if (!program) {
        program = await this.setupReferralProgram(botId);
      }
      
      const stats = await this.getProgramStats(botId);

      let message = `💰 <b>Referral Program Management</b>\n\n`;

      if (program) {
        message += `<b>Status:</b> ${program.is_enabled ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n` +
          `<b>Referral Rate:</b> ${program.currency} ${program.referral_rate}\n` +
          `<b>Min Withdrawal:</b> ${program.currency} ${program.min_withdrawal}\n\n` +
          `<b>Program Stats:</b>\n` +
          `• Total Referrals: ${stats.totalReferrals}\n` +
          `• Completed: ${stats.completedReferrals}\n` +
          `• Total Paid Out: ${program.currency} ${stats.totalPaid.toFixed(2)}\n` +
          `• Pending Withdrawals: ${program.currency} ${stats.pendingWithdrawals.toFixed(2)}\n` +
          `• Active Users: ${stats.activeUsers}\n\n`;
      } else {
        message += `⚠️ Referral program not configured.\n\n`;
      }

      message += `<b>Features:</b>\n` +
        `• Custom referral rates\n` +
        `• Withdrawal management\n` +
        `• Channel requirements\n` +
        `• Real-time tracking`;

      const keyboardButtons = [];

      if (program) {
        keyboardButtons.push(
          [Markup.button.callback(
            program.is_enabled ? '🚫 Disable Program' : '✅ Enable Program', 
            `ref_toggle_${botId}`
          )],
          [Markup.button.callback('✏️ Edit Settings', `ref_settings_${botId}`)],
          [Markup.button.callback('📊 Program Stats', `ref_stats_${botId}`)],
          [Markup.button.callback('💳 Withdrawal Requests', `ref_withdrawals_${botId}`)]
        );
      } else {
        keyboardButtons.push(
          [Markup.button.callback('🚀 Setup Program', `ref_setup_${botId}`)]
        );
      }

      keyboardButtons.push(
        [Markup.button.callback('🔙 Back to Settings', `mini_settings`)]
      );

      const keyboard = Markup.inlineKeyboard(keyboardButtons);

      if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.message) {
        await this.safeEditMessageWithHTML(ctx, message, keyboard);
      } else {
        await this.safeReplyWithHTML(ctx, message, keyboard);
      }

    } catch (error) {
      console.error('Show referral management error:', error);
      await ctx.reply('❌ Error loading referral management.');
    }
  }

  // Toggle referral program
  static async toggleReferralProgram(ctx, botId) {
    try {
      let program = await ReferralProgram.findOne({ where: { bot_id: botId } });
      
      if (!program) {
        program = await this.setupReferralProgram(botId);
      }

      const newStatus = !program.is_enabled;
      await program.update({ is_enabled: newStatus });

      await ctx.answerCbQuery(`✅ Program ${newStatus ? 'enabled' : 'disabled'}`);
      await this.showReferralManagement(ctx, botId);

    } catch (error) {
      console.error('Toggle referral program error:', error);
      await ctx.answerCbQuery('❌ Error toggling program');
    }
  }

  // Get program-wide stats - FIXED: Add active users count
  static async getProgramStats(botId) {
    try {
      const [totalReferrals, completedReferrals, totalPaid, pendingWithdrawals, activeUsers] = await Promise.all([
        Referral.count({ where: { bot_id: botId } }),
        Referral.count({ where: { bot_id: botId, is_completed: true } }),
        Referral.sum('amount_earned', { where: { bot_id: botId, is_completed: true } }),
        Withdrawal.sum('amount', { where: { bot_id: botId, status: ['pending', 'processing'] } }),
        Referral.count({ 
          where: { bot_id: botId },
          distinct: true,
          col: 'referrer_id'
        })
      ]);

      return {
        totalReferrals: totalReferrals || 0,
        completedReferrals: completedReferrals || 0,
        totalPaid: totalPaid || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
        activeUsers: activeUsers || 0
      };
    } catch (error) {
      return {
        totalReferrals: 0,
        completedReferrals: 0,
        totalPaid: 0,
        pendingWithdrawals: 0,
        activeUsers: 0
      };
    }
  }

  // Process text input for withdrawal amounts
  static async processWithdrawalTextInput(ctx, botId, input) {
    try {
      // Clean up expired sessions first
      this.cleanupExpiredSessions();

      const session = this.withdrawalSessions?.get(ctx.from.id);
      
      // Check if this is a withdrawal session
      if (session && session.botId == botId && session.step === 'awaiting_withdrawal_amount') {
        return await this.processWithdrawalAmount(ctx, botId, input);
      }

      // Also check for referral setting sessions
      const referralSession = this.referralSessions?.get(ctx.from.id);
      if (referralSession && referralSession.botId == botId) {
        return await this.processReferralSettingChange(ctx, botId, input);
      }

      return false;
    } catch (error) {
      console.error('Process withdrawal text input error:', error);
      return false;
    }
  }

  // NEW METHOD: Check if user has active withdrawal session
  static hasActiveWithdrawalSession(userId, botId) {
    this.cleanupExpiredSessions();
    const session = this.withdrawalSessions?.get(userId);
    return session && session.botId == botId && session.step === 'awaiting_withdrawal_amount';
  }

  // NEW METHOD: Check if user has active referral session
  static hasActiveReferralSession(userId, botId) {
    this.cleanupExpiredSessions();
    const session = this.referralSessions?.get(userId);
    return session && session.botId == botId;
  }

  // Register callback handlers
  static registerCallbacks(bot) {
    console.log('🔄 Registering referral callback handlers...');
    
    // Currency change callbacks
    bot.action(/^ref_change_currency_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.startChangeCurrency(ctx, botId);
    });
    
    bot.action(/^ref_set_currency_(.+)_(.+)/, async (ctx) => {
      const [, botId, currency] = ctx.match;
      await ReferralHandler.handleCurrencySelection(ctx, botId, currency);
    });
    
    // Settings callbacks
    bot.action(/^ref_change_rate_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.startChangeReferralRate(ctx, botId);
    });
    
    bot.action(/^ref_change_min_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.startChangeMinWithdrawal(ctx, botId);
    });
    
    bot.action(/^ref_reset_settings_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.resetReferralSettings(ctx, botId);
    });
    
    // Management callbacks
    bot.action(/^ref_toggle_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.toggleReferralProgram(ctx, botId);
    });
    
    bot.action(/^ref_settings_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.handleReferralSettings(ctx, botId);
    });
    
    bot.action(/^ref_stats_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.handleReferralStats(ctx, botId);
    });
    
    bot.action(/^ref_withdrawals_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.handleWithdrawalRequests(ctx, botId);
    });
    
    bot.action(/^ref_manage_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.showReferralManagement(ctx, botId);
    });
    
    // User referral callbacks
    bot.action(/^ref_dashboard_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.showReferralDashboard(ctx, botId);
    });
    
    bot.action(/^my_referees_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.showUserReferrals(ctx, botId);
    });
    
    bot.action(/^withdraw_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.handleWithdrawal(ctx, botId);
    });
    
    bot.action(/^share_ref_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.handleShareReferral(ctx, botId);
    });
    
    // Withdrawal approval callbacks
    bot.action(/^approve_withdrawal_(.+)/, async (ctx) => {
      const withdrawalId = ctx.match[1];
      await ReferralHandler.approveWithdrawal(ctx, withdrawalId);
    });
    
    bot.action(/^reject_withdrawal_(.+)/, async (ctx) => {
      const withdrawalId = ctx.match[1];
      await ReferralHandler.rejectWithdrawal(ctx, withdrawalId);
    });
    
    // Setup callback
    bot.action(/^ref_setup_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.setupReferralProgram(botId);
      await ReferralHandler.showReferralManagement(ctx, botId);
    });
    
    console.log('✅ Referral callback handlers registered');
  }
}

// Session storage
ReferralHandler.withdrawalSessions = new Map();
ReferralHandler.referralSessions = new Map();

module.exports = ReferralHandler;