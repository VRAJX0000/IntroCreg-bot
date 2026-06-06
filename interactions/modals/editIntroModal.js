
const { Events, MessageFlags, EmbedBuilder } = require('discord.js');
const { createSubmissionEmbed } = require('../../utils/embedBuilder');
const { addSubmission } = require('../../utils/persistence');

module.exports = {
    id: 'editIntroModal',
    /**
     * @param {import('discord.js').ModalSubmitInteraction} interaction 
     */
    async execute(interaction) {
        // 1. Defer Update immediately (we are updating the message we came from)
        await interaction.deferUpdate();

        const name = interaction.fields.getTextInputValue('nameInput');
        const age = interaction.fields.getTextInputValue('ageInput');
        const profession = interaction.fields.getTextInputValue('professionInput');
        const platform = interaction.fields.getTextInputValue('platformInput');
        const game = interaction.fields.getTextInputValue('gameInput');

        // Validation: Age must be numeric
        if (isNaN(age)) {
            return interaction.followUp({
                content: '❌ Age must be a number!',
                flags: MessageFlags.Ephemeral
            });
        }

        // We need to fetch the original user to reconstruct the embed author accurately.
        // However, we don't strictly have the original author object here, only the text in the embed.
        // But the previous embed has the author name and iconURL.
        const oldEmbed = interaction.message.embeds[0];

        // Preserve Gender if it exists in the old embed
        const oldFields = oldEmbed.fields;
        const genderField = oldFields.find(f => f.name === 'Gender');
        const gender = genderField ? genderField.value : 'Not specified';

        // Extract Target User ID
        // 1. Try from Custom ID (Primary Method)
        let targetUserId = null;
        if (interaction.customId.startsWith('editIntroModal_')) {
            targetUserId = interaction.customId.split('_')[1];
        }

        // 2. Fallback to Embed Field (Legacy Support)
        if (!targetUserId) {
            const requestUserField = oldFields.find(f => f.name === '🆔 User ID');
            targetUserId = requestUserField ? requestUserField.value : null;
        }

        const submissionData = {
            name,
            age,
            gender,
            profession,
            platform,
            game
        };

        // Rebuild Embed
        const newEmbed = EmbedBuilder.from(oldEmbed)
            .setFields(
                { name: 'Name', value: submissionData.name, inline: true },
                { name: 'Age', value: submissionData.age, inline: true },
                { name: 'Gender', value: gender, inline: true }, // Preserved Gender
                { name: 'Profession', value: submissionData.profession || 'Not specified', inline: true },
                { name: 'Platform', value: submissionData.platform, inline: true },
                { name: 'What do you do?', value: submissionData.game || 'Not specified', inline: false }
            )
            .setTimestamp(); // Update timestamp

        try {
            await interaction.editReply({
                embeds: [newEmbed]
            });

            // Update Persistence
            if (targetUserId) {
                // We don't have messageId/channelId easily available here (it's the current message/channel)
                // But addSubmission merges data, so we mainly want to update submissionData
                // Wait, addSubmission replaces the object structure in my implementation:
                // data[guildId][userId] = { ...metadata, timestamp: Date.now() }; gets replaced?
                // Step 129: data[guildId][userId] = { ...metadata, timestamp: Date.now() };
                // It replaces the WHOLE object for that user.
                // So I need to preserve messageId and channelId if I can.
                // But I am acting on the message itself (interaction.message).

                await addSubmission(interaction.guild.id, targetUserId, {
                    messageId: interaction.message.id,
                    channelId: interaction.channel.id,
                    submissionData: submissionData,
                    status: 'pending' // Still pending approval
                });
            } else {
                console.warn('Could not find Target User ID in embed. Persistence not updated.');
            }

            // Optional: Confirm to mod (ephemeral followUp)
            await interaction.followUp({
                content: '✅ Introduction updated successfully.',
                flags: MessageFlags.Ephemeral
            });

            // Log Action
            const { logAction } = require('../../utils/logger');
            const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);

            logAction(interaction.client, interaction.guild.id, 'INTRO_EDIT', {
                user: targetUser || { tag: 'Unknown User', id: targetUserId }, // The user whose intro was edited
                details: `Introduction edited by ${interaction.user}.` // The moderator who did it
            });

        } catch (error) {
            console.error('Error updating introduction:', error);
            await interaction.followUp({
                content: '❌ Failed to update introduction.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
