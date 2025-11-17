module.exports = (sequelize, DataTypes) => {
  const CommandExecution = sequelize.define('CommandExecution', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    command_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    input_data: { type: DataTypes.JSON },
    output_data: { type: DataTypes.JSON },
    status: { type: DataTypes.STRING, defaultValue: 'completed' }, // completed, failed, in_progress
    execution_time: { type: DataTypes.INTEGER } // milliseconds
  });

  return CommandExecution;
};