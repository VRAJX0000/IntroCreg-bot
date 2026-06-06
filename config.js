require('dotenv').config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    // Server specific configuration should be in serverConfig.json
    // guildId: '1314812316886597652', // REMOVED: Use serverConfig.json
    // modRoleId: '1326417726613618751', // REMOVED: Use serverConfig.json
    // submissionChannelId: '1326417937968791654', // REMOVED: Use serverConfig.json
    embedColor: 0x0099ff,

    // Database Config (Loaded from process.env)
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    },

    // Developer IDs for restricted commands
    devIds: ['934654289006198846'] // Add developer IDs here
};
