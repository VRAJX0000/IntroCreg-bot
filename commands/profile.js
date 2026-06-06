const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { getSubmission } = require('../utils/persistence');
const { getLogoAttachment } = require('../utils/notificationUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Displays the introduction card of a user.')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view (defaults to yourself)')
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const { t } = require('../utils/lang');

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        // Fetch submission data
        const submission = await getSubmission(guildId, targetUser.id);

        if (!submission || !submission.submissionData) {
            return interaction.editReply({
                content: `❌ ${t('profile.not_found', guildId, { user: targetUser.username })}`,
            });
        }

        const data = submission.submissionData;

        // Reconstruct the embed
        const { attachment, url } = getLogoAttachment();

        const embed = createEmbed(
            t('profile.title', guildId, { user: data.name }),
            `Here is what we know about ${targetUser}:`
        );

        embed.setColor(0x00A2FF) // Light Blue
            .addFields(
                { name: t('profile.field_name', guildId) || '📛 Name', value: data.name || 'Not specified', inline: true },
                { name: t('profile.field_age', guildId) || 'Age', value: data.age || 'Not specified', inline: true },
                { name: t('profile.field_gender', guildId) || 'Gender', value: data.gender || 'Not specified', inline: true },
                { name: t('profile.field_profession', guildId) || 'Profession', value: data.profession || 'Not specified', inline: true },
                { name: t('profile.field_platform', guildId) || 'Platform', value: data.platform || 'Not specified', inline: true },
                { name: t('profile.field_game', guildId) || 'Game/Activity', value: data.game || 'Not specified', inline: true }
            )
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Joined: ${targetUser.createdAt.toLocaleDateString()}`, iconURL: url });

        const payload = { embeds: [embed] };
        if (attachment) {
            payload.files = [attachment];
        }

        await interaction.editReply(payload);
    },
};
