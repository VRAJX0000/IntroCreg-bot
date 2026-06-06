const { MessageFlags, EmbedBuilder } = require('discord.js');
const { getSubmission, addSubmission } = require('../../utils/persistence');
const { getConfig } = require('../../utils/serverConfig');
const config = require('../../config');

module.exports = {
    id: 'admin_gender_select', // Dynamic ID: admin_gender_select_USERID
    async execute(interaction) {
        await interaction.deferUpdate();

        const targetUserId = interaction.customId.split('admin_gender_select_')[1];
        const selectedGender = interaction.values[0];
        const guildId = interaction.guild.id;

        if (!targetUserId) {
            return interaction.followUp({ content: '❌ Error identifying target user.', flags: MessageFlags.Ephemeral });
        }

        const submission = await getSubmission(guildId, targetUserId);
        if (!submission) {
            return interaction.followUp({ content: '❌ Submission data not found.', flags: MessageFlags.Ephemeral });
        }

        const oldGender = submission.submissionData.gender;

        // 1. Update Persistence
        submission.submissionData.gender = selectedGender;
        await addSubmission(guildId, targetUserId, {
            messageId: submission.messageId,
            channelId: submission.channelId,
            submissionData: submission.submissionData,
            status: submission.status // Keep existing status (e.g. approved)
        });

        // 2. Update Embed in Public Channel
        if (submission.channelId && submission.messageId) {
            try {
                const channel = await interaction.guild.channels.fetch(submission.channelId);
                const message = await channel.messages.fetch(submission.messageId);
                const oldEmbed = message.embeds[0];

                const newEmbed = EmbedBuilder.from(oldEmbed)
                    .setFields(
                        // Map existing fields, but update Gender
                        oldEmbed.fields.map(field => {
                            if (field.name === 'Gender') {
                                return { name: 'Gender', value: selectedGender, inline: true };
                            }
                            return field;
                        })
                    );
                // If Gender field didn't exist before, we might want to add it? 
                // But map() works if it already exists. If it's missing (b/c of old bug), we should rebuild properly.
                // Let's rely on the robust rebuilding logic if we can, or just force find/replace.
                // To be safe, let's use the explicit field reconstruction like in Modals for consistency.
                const submissionData = submission.submissionData;
                const newEmbedRobust = EmbedBuilder.from(oldEmbed)
                    .setFields(
                        { name: 'Name', value: submissionData.name, inline: true },
                        { name: 'Age', value: submissionData.age, inline: true },
                        { name: 'Gender', value: selectedGender, inline: true },
                        { name: 'Profession', value: submissionData.profession || 'Not specified', inline: true },
                        { name: 'Platform', value: submissionData.platform, inline: true },
                        { name: 'Game', value: submissionData.game || 'Not specified', inline: false }
                    );

                await message.edit({ embeds: [newEmbedRobust] });

            } catch (err) {
                console.error("Failed to update public embed:", err);
                await interaction.followUp({ content: '⚠️ DB updated, but failed to update public message (it may have been deleted).', flags: MessageFlags.Ephemeral });
            }
        }

        // 3. Sync Roles
        const serverConfig = getConfig(guildId);

        try {
            const targetMember = await interaction.guild.members.fetch(targetUserId);

            // Remove Old Roles
            if (serverConfig.maleRoleId && targetMember.roles.cache.has(serverConfig.maleRoleId)) await targetMember.roles.remove(serverConfig.maleRoleId);
            if (serverConfig.femaleRoleId && targetMember.roles.cache.has(serverConfig.femaleRoleId)) await targetMember.roles.remove(serverConfig.femaleRoleId);
            if (serverConfig.otherRoleId && targetMember.roles.cache.has(serverConfig.otherRoleId)) await targetMember.roles.remove(serverConfig.otherRoleId);

            // Add New Role
            let newRoleId = null;
            if (selectedGender === 'Male') newRoleId = serverConfig.maleRoleId;
            if (selectedGender === 'Female') newRoleId = serverConfig.femaleRoleId;
            if (selectedGender === 'Other') newRoleId = serverConfig.otherRoleId;

            if (newRoleId) {
                await targetMember.roles.add(newRoleId);
            }

            await interaction.editReply({
                content: `✅ Updated **${targetMember.user.tag}** to **${selectedGender}**.\n- Database updated.\n- Embed updated.\n- Roles synced.`,
                components: [] // Remove menu
            });

        } catch (err) {
            console.error("Failed to sync roles:", err);
            await interaction.editReply({
                content: `✅ Gender updated to **${selectedGender}**, but failed to sync roles (check permissions).`,
                components: []
            });
        }
    }
};
