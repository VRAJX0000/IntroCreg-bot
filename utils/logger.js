const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('./serverConfig');

const LOG_TYPES = {
    USER_JOIN: { title: '📥 User Joined', color: 0x57F287, emoji: '👋' },
    USER_LEAVE: { title: '📤 User Left', color: 0xED4245, emoji: '👋' },
    INTRO_SUBMIT: { title: '📝 Intro Submitted', color: 0xFEE75C, emoji: '📋' },
    INTRO_STATUS: { title: '⚖️ Intro Status', color: 0x5865F2, emoji: '✅' },
    CONFIG_UPDATE: { title: '⚙️ Config Updated', color: 0x3498DB, emoji: '🛠️' },
    MOD_ACTION: { title: '🛡️ Moderation Action', color: 0xE74C3C, emoji: '🔨' },
    MEMBER_UPDATE: { title: '👤 Member Updated', color: 0x9B59B6, emoji: '🔄' },
    ERROR: { title: '⚠️ Bot Error', color: 0xE67E22, emoji: '⚠️' }
};

/**
 * Sends a log embed to the configured server log channel.
 * @param {import('discord.js').Client} client 
 * @param {string} guildId 
 * @param {string} typeKey - Key from LOG_TYPES
 * @param {Object} data - { user, details, fields }
 */
async function logAction(client, guildId, typeKey, data = {}) {
    try {
        const config = getConfig(guildId);
        if (!config || !config.logChannelId) return; // Logging not enabled

        const channel = client.channels.cache.get(config.logChannelId);
        if (!channel) return;

        const type = LOG_TYPES[typeKey] || { title: 'Log', color: 0x95A5A6, emoji: '📝' };

        const embed = new EmbedBuilder()
            .setTitle(`${type.emoji} ${type.title}`)
            .setColor(type.color)
            .setTimestamp();

        if (data.user) {
            embed.setAuthor({ name: data.user.tag, iconURL: data.user.displayAvatarURL() });
            embed.setFooter({ text: `User ID: ${data.user.id}` });
        }

        if (data.details) {
            embed.setDescription(data.details);
        }

        if (data.fields && Array.isArray(data.fields)) {
            embed.addFields(data.fields);
        }

        await channel.send({ embeds: [embed] });

    } catch (err) {
        console.error('Failed to send log:', err);
    }
}

module.exports = { logAction };
