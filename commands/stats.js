const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { getStats } = require('../utils/persistence');
const { getLogoAttachment } = require('../utils/notificationUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Shows server statistics for introductions.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();

        const { t } = require('../utils/lang');
        const guildId = interaction.guild.id;

        const { totalApproved, totalPending } = await getStats(guildId);
        const { attachment, url } = getLogoAttachment();

        const embed = createEmbed(t('stats.title', guildId), `Overview of **${interaction.guild.name}** introduction activity.`);

        embed.setColor(0xFEE75C) // Gold
            .addFields(
                { name: `✅ ${t('stats.approved', guildId)}`, value: `${totalApproved}`, inline: true },
                { name: `⏳ ${t('stats.pending', guildId)}`, value: `${totalPending}`, inline: true },
                { name: '📅 Date', value: new Date().toLocaleDateString(), inline: false }
            )
            .setFooter({ text: 'Intro Creg Stats', iconURL: url });

        const payload = { embeds: [embed] };
        if (attachment) {
            payload.files = [attachment];
        }

        await interaction.editReply(payload);
    },
};
