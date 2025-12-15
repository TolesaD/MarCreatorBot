const { sequelize } = require('../../database/db');

// Core models (should always exist)
const User = require('./User');
const Bot = require('./Bot');
const Admin = require('./Admin');
const Feedback = require('./Feedback');
const UserLog = require('./UserLog');
const BroadcastHistory = require('./BroadcastHistory');

// Extended models (might be missing initially)
let ChannelJoin, ReferralProgram, Referral, Withdrawal, UserBan;

try {
  ChannelJoin = require('./ChannelJoin');
} catch (error) {
  console.log('⚠️ ChannelJoin model not found, creating placeholder');
  ChannelJoin = null;
}

try {
  ReferralProgram = require('./ReferralProgram');
} catch (error) {
  console.log('⚠️ ReferralProgram model not found, creating placeholder');
  ReferralProgram = null;
}

try {
  Referral = require('./Referral');
} catch (error) {
  console.log('⚠️ Referral model not found, creating placeholder');
  Referral = null;
}

try {
  Withdrawal = require('./Withdrawal');
} catch (error) {
  console.log('⚠️ Withdrawal model not found, creating placeholder');
  Withdrawal = null;
}

try {
  UserBan = require('./UserBan');
} catch (error) {
  console.log('⚠️ UserBan model not found, creating placeholder');
  UserBan = null;
}

// Botomics models
const Wallet = require('./Wallet');
const WalletTransaction = require('./WalletTransaction');
const UserSubscription = require('./UserSubscription');
const BotNiche = require('./BotNiche');
const BotAdSettings = require('./BotAdSettings');
const AdCampaign = require('./AdCampaign');
const AdEvent = require('./AdEvent');
const PlatformSettings = require('./PlatformSettings');

// ==================== ASSOCIATIONS ====================

// User associations
User.hasMany(Bot, {
  foreignKey: 'owner_id',
  sourceKey: 'telegram_id',
  as: 'OwnedBots'
});

// Bot belongs to User (owner)
Bot.belongsTo(User, { 
  foreignKey: 'owner_id', 
  targetKey: 'telegram_id', 
  as: 'Owner' 
});

// User has one Wallet with alias 'WalletUser'
User.hasOne(Wallet, {
  foreignKey: 'user_id',
  targetKey: 'telegram_id',
  as: 'WalletUser'
});

Wallet.belongsTo(User, {
  foreignKey: 'user_id',
  targetKey: 'telegram_id',
  as: 'WalletUser'
});

// User has many Subscriptions with alias 'SubscriptionUser'
User.hasMany(UserSubscription, {
  foreignKey: 'user_id',
  targetKey: 'telegram_id',
  as: 'SubscriptionUser'  // FIXED: Added alias for subscriptions
});

UserSubscription.belongsTo(User, {
  foreignKey: 'user_id',
  targetKey: 'telegram_id',
  as: 'SubscriptionUser'
});

// Admin associations
Admin.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'AdminBot'
});

Admin.belongsTo(User, { 
  foreignKey: 'admin_user_id', 
  targetKey: 'telegram_id', 
  as: 'AdminUser'
});

Bot.hasMany(Admin, { 
  foreignKey: 'bot_id', 
  as: 'Admins' 
});

// Feedback associations
Feedback.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'FeedbackBot'
});

Bot.hasMany(Feedback, { 
  foreignKey: 'bot_id', 
  as: 'Feedbacks' 
});

Feedback.belongsTo(User, {
  foreignKey: 'replied_by',
  targetKey: 'telegram_id',
  as: 'FeedbackReplier'
});

// UserLog associations
UserLog.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'UserLogBot'
});

Bot.hasMany(UserLog, { 
  foreignKey: 'bot_id', 
  as: 'UserLogs' 
});

// BroadcastHistory associations
BroadcastHistory.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'BroadcastBot'
});

Bot.hasMany(BroadcastHistory, { 
  foreignKey: 'bot_id', 
  as: 'BroadcastHistories' 
});

BroadcastHistory.belongsTo(User, {
  foreignKey: 'sent_by',
  targetKey: 'telegram_id',
  as: 'BroadcastSender'
});

// Botomics associations
WalletTransaction.belongsTo(Wallet, {
  foreignKey: 'wallet_id',
  as: 'wallet'
});

Wallet.hasMany(WalletTransaction, {
  foreignKey: 'wallet_id',
  as: 'transactions'
});

BotAdSettings.belongsTo(Bot, {
  foreignKey: 'bot_id',
  as: 'AdSettingsBot'
});

BotAdSettings.belongsTo(BotNiche, {
  foreignKey: 'niche_id',
  as: 'BotNiche'
});

AdCampaign.belongsTo(Bot, {
  foreignKey: 'bot_id',
  as: 'CampaignBot'
});

AdEvent.belongsTo(AdCampaign, {
  foreignKey: 'campaign_id',
  as: 'EventCampaign'
});

AdEvent.belongsTo(Bot, {
  foreignKey: 'bot_id',
  as: 'EventBot'
});

// Conditionally define associations for extended models
if (ChannelJoin) {
  ChannelJoin.belongsTo(Bot, { 
    foreignKey: 'bot_id', 
    as: 'ChannelBot'
  });

  Bot.hasMany(ChannelJoin, { 
    foreignKey: 'bot_id', 
    as: 'ChannelJoins' 
  });
}

if (ReferralProgram) {
  ReferralProgram.belongsTo(Bot, { 
    foreignKey: 'bot_id', 
    as: 'ReferralProgramBot'
  });

  Bot.hasOne(ReferralProgram, { 
    foreignKey: 'bot_id', 
    as: 'ReferralProgram' 
  });
}

if (Referral) {
  Referral.belongsTo(Bot, { 
    foreignKey: 'bot_id', 
    as: 'ReferralBot'
  });

  Bot.hasMany(Referral, { 
    foreignKey: 'bot_id', 
    as: 'Referrals' 
  });
}

if (Withdrawal) {
  Withdrawal.belongsTo(Bot, { 
    foreignKey: 'bot_id', 
    as: 'WithdrawalBot'
  });

  Bot.hasMany(Withdrawal, { 
    foreignKey: 'bot_id', 
    as: 'Withdrawals' 
  });

  Withdrawal.belongsTo(User, {
    foreignKey: 'user_id',
    targetKey: 'telegram_id',
    as: 'WithdrawalUser'
  });

  Withdrawal.belongsTo(User, {
    foreignKey: 'processed_by',
    targetKey: 'telegram_id',
    as: 'WithdrawalProcessor'
  });
}

if (UserBan) {
  UserBan.belongsTo(Bot, { 
    foreignKey: 'bot_id', 
    as: 'BanBot'
  });

  Bot.hasMany(UserBan, { 
    foreignKey: 'bot_id', 
    as: 'UserBans' 
  });

  UserBan.belongsTo(User, {
    foreignKey: 'user_id',
    targetKey: 'telegram_id',
    as: 'BannedUser'
  });

  UserBan.belongsTo(User, {
    foreignKey: 'banned_by',
    targetKey: 'telegram_id',
    as: 'BanInitiator'
  });

  UserBan.belongsTo(User, {
    foreignKey: 'unbanned_by',
    targetKey: 'telegram_id',
    as: 'UnbanInitiator'
  });
}

module.exports = {
  sequelize,
  User,
  Bot,
  Admin,
  Feedback,
  UserLog,
  BroadcastHistory,
  ChannelJoin,
  ReferralProgram,
  Referral,
  Withdrawal,
  UserBan,
  // Botomics models
  Wallet,
  WalletTransaction,
  UserSubscription,
  BotNiche,
  BotAdSettings,
  AdCampaign,
  AdEvent,
  PlatformSettings
};