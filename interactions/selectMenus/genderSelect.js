const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const { getConfig } = require('../../utils/serverConfig');
const { createSubmissionEmbed } = require('../../utils/embedBuilder');
const { addSubmission, getSubmission } = require('../../utils/persistence');

module.exports = {
    id: 'gender_select',
    async execute(interaction) {
        // Defer update to avoid "Interaction failed"
        await interaction.deferUpdate();

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const selectedGender = interaction.values[0];

        const { t } = require('../../utils/lang');

        // 1. Retrieve Draft Submission
        const submission = await getSubmission(guildId, userId);

        if (!submission || submission.status !== 'draft_gender') {
            return interaction.followUp({
                content: t('intro.session_expired', guildId),
                flags: MessageFlags.Ephemeral
            });
        }

        // 2. Update Submission Data with Gender
        submission.submissionData.gender = selectedGender;

        // Update Persistence to PENDING
        await addSubmission(guildId, userId, {
            submissionData: submission.submissionData,
            status: 'pending' // Ready for review
        });

        // 3. Check Auto-Approve
        const serverConfig = getConfig(guildId);
        if (serverConfig.autoApprove) {
            // --- AUTO APPROVE LOGIC ---
            const subChannelId = serverConfig.submissionChannelId;
            let publicChannel = interaction.client.channels.cache.get(subChannelId);

            if (!publicChannel) {
                try {
                    publicChannel = await interaction.client.channels.fetch(subChannelId);
                } catch (error) {
                    console.error(`Failed to fetch Public Channel (${subChannelId}):`, error);
                }
            }

            if (!publicChannel) {
                return interaction.editReply({
                    content: '❌ System Error: Public submission channel not found. Cannot auto-approve.',
                    components: []
                });
            }

            const { getLogoAttachment } = require('../../utils/notificationUtils');
            // const { attachment, url } = getLogoAttachment();
            const url = interaction.client.user.displayAvatarURL();
            const embed = createSubmissionEmbed(interaction.user, submission.submissionData, url);
            const { EmbedBuilder } = require('discord.js');

            try {
                // Post to Public Channel
                const sentMessage = await publicChannel.send({ embeds: [embed] });

                // Update Persistence to APPROVED
                // Update submission data with gender first (already done above in memory)
                await addSubmission(guildId, userId, {
                    messageId: sentMessage.id,
                    channelId: publicChannel.id,
                    submissionData: submission.submissionData,
                    status: 'approved'
                });

                // Assign Roles
                const member = await interaction.guild.members.fetch(userId);

                // Approved Role
                if (serverConfig.approvedRoleId) {
                    try {
                        await member.roles.add(serverConfig.approvedRoleId);
                    } catch (e) { console.error('Failed to add approved role', e); }
                }

                // Gender Role
                let genderRoleId = null;
                if (selectedGender === 'Male') genderRoleId = serverConfig.maleRoleId;
                if (selectedGender === 'Female') genderRoleId = serverConfig.femaleRoleId;


                if (genderRoleId) {
                    try {
                        await member.roles.add(genderRoleId);
                    } catch (e) { console.error('Failed to add gender role', e); }
                }

                // Notify User
                const dmEmbed = new EmbedBuilder()
                    .setTitle(t('moderation.dm_approved_title', guildId))
                    .setDescription(t('moderation.dm_approved_desc', guildId, { guild: interaction.guild.name }))
                    .setColor(0x57F287)
                    .setTimestamp();

                if (url) dmEmbed.setFooter({ text: 'Welcome aboard! 🚀', iconURL: url });

                const payload = { embeds: [dmEmbed] };
                // if (attachment) payload.files = [attachment];

                try {
                    await member.send(payload);
                } catch (e) { /* Ignore DM fail */ }

                // Reply to Interaction
                await interaction.editReply({
                    content: `✅ **Success!** Your introduction has been automatically approved and posted to ${publicChannel}.`,
                    components: []
                });

                // Log
                const { logAction } = require('../../utils/logger');
                logAction(interaction.client, guildId, 'INTRO_STATUS', {
                    user: interaction.user,
                    details: `Auto-approved introduction.`
                });

            } catch (err) {
                console.error('Auto-approve error:', err);
                await interaction.editReply({
                    content: '❌ Error processing auto-approval. Please contact an admin.',
                    components: []
                });
            }

        } else {
            // --- EXISTING MANUAL APPROVAL LOGIC ---
            // 3. Send to Admin Channel (Logic moved from introModal)
            // Use Bot Avatar for footer to avoid attaching large file
            const url = interaction.client.user.displayAvatarURL();
            // const { getLogoAttachment } = require('../../utils/notificationUtils');
            // const { attachment, url } = getLogoAttachment();

            const embed = createSubmissionEmbed(interaction.user, submission.submissionData, url);

            const channelId = serverConfig.adminChannelId || config.adminChannelId;
            let channel = interaction.client.channels.cache.get(channelId);

            if (!channel) {
                try {
                    channel = await interaction.client.channels.fetch(channelId);
                } catch (error) {
                    console.error(`Failed to fetch Admin Channel (${channelId}):`, error);
                }
            }

            if (!channel) {
                console.error(`Admin Channel with ID ${channelId} not found.`);
                return interaction.editReply({
                    content: '❌ System Error: Admin channel not found. Please contact an admin.',
                    components: [] // Remove select menu
                });
            }

            // Create Moderation Buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_btn_${userId}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`edit_btn_${userId}`)
                    .setLabel('Edit')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️'),
                new ButtonBuilder()
                    .setCustomId(`reject_btn_${userId}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⛔')
            );

            try {
                const payload = {
                    content: `New submission from ${interaction.user} awaiting review:`,
                    embeds: [embed],
                    components: [row]
                };

                // if (attachment) {
                //     payload.files = [attachment];
                // }

                await channel.send(payload);

                // 4. Final User Reply
                await interaction.editReply({
                    content: t('intro.submit_success', guildId),
                    components: [] // Remove select menu
                });

                // Log Submission
                const { logAction } = require('../../utils/logger');
                logAction(interaction.client, guildId, 'INTRO_SUBMIT', {
                    user: interaction.user,
                    details: `Submitted an introduction for review.`,
                    fields: [
                        { name: 'Name', value: submission.submissionData.name, inline: true },
                        { name: 'Profession', value: submission.submissionData.profession, inline: true }
                    ]
                });

            } catch (error) {
                console.error('Error sending embed:', error);
                await interaction.editReply({
                    content: t('intro.submit_error', guildId),
                    components: []
                });
            }
        }
    }
};
