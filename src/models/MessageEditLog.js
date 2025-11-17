module.exports = (sequelize, DataTypes) => {
  const MessageEditLog = sequelize.define('MessageEditLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    bot_id: { type: DataTypes.INTEGER, allowNull: false },
    original_message_id: { type: DataTypes.INTEGER, allowNull: false },
    original_content: { type: DataTypes.TEXT, allowNull: false },
    new_content: { type: DataTypes.TEXT, allowNull: false },
    edited_by: { type: DataTypes.INTEGER, allowNull: false },
    edit_reason: { type: DataTypes.STRING }
  });

  return MessageEditLog;
};