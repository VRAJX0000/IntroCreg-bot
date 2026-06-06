const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { getConfig } = require('./serverConfig');

function getDynamicColor(guildId) {
    // If guildId is provided, look up that guild's config.
    // If not, fall back to global config or default.
    const serverConfig = guildId ? getConfig(guildId) : {};
    if (serverConfig.embedColor) {
        return serverConfig.embedColor;
    }
    return config.embedColor;
}

/**
 * Creates a standardized embed.
 * @param {string} title 
 * @param {string} description 
 * @returns {EmbedBuilder}
 */
function createEmbed(title, description) {
    const embed = new EmbedBuilder()
        .setColor(getDynamicColor())
        .setTimestamp();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);

    return embed;
}

/**
 * Creates the submission embed.
 * @param {import('discord.js').User} user 
 * @param {object} data
 * @returns {EmbedBuilder}
 */
function createSubmissionEmbed(user, data, logoUrl = null) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setTitle('New Introduction Submitted')
        .setColor(getDynamicColor()) // Use configured color
        .addFields(
            { name: 'Name', value: data.name, inline: true },
            { name: 'Age', value: data.age, inline: true },
            { name: 'Gender', value: data.gender || 'Not specified', inline: true },
            { name: 'Profession', value: data.profession || 'Not specified', inline: true },
            { name: 'Platform', value: data.platform, inline: true },
            { name: 'What do you do?', value: data.game || 'Not specified', inline: false },
            { name: '🆔 User ID', value: user.id, inline: false } // Required for Admin Edits to track original user
        )
        .setFooter({ text: `Submitted by ${user.username}` })
        .setTimestamp();

    if (logoUrl) {
        embed.setFooter({ text: `Submitted by ${user.username} • Intro Creg`, iconURL: logoUrl });
    }

    return embed;
}

module.exports = { createEmbed, createSubmissionEmbed };
