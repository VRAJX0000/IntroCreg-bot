const { MessageFlags, EmbedBuilder } = require('discord.js');
const { getSubmission, addSubmission } = require('../../utils/persistence');

module.exports = {
    id: 'adminEditModal', // Note: actual ID is dynamic: adminEditModal_USERID
    /**
     * @param {import('discord.js').ModalSubmitInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Extract target User ID from customId
        const targetUserId = interaction.customId.split('_')[1];
        if (!targetUserId) {
            return interaction.editReply({ content: '❌ Error: Could not identify target user.' });
        }

        const submission = await getSubmission(interaction.guild.id, targetUserId);
        if (!submission || !submission.messageId || !submission.channelId) {
            return interaction.editReply({ content: '❌ Error: Original submission data missing or incomplete. Cannot edit.' });
        }

        const newData = {
            name: interaction.fields.getTextInputValue('nameInput'),
            age: interaction.fields.getTextInputValue('ageInput'),
            profession: interaction.fields.getTextInputValue('professionInput'),
            platform: interaction.fields.getTextInputValue('platformInput'),
            game: interaction.fields.getTextInputValue('gameInput'),
            gender: submission.submissionData.gender // Preserve Gender from DB
        };

        // Validation
        if (isNaN(newData.age)) {
            return interaction.editReply({ content: '❌ Age must be a number!' });
        }

        try {
            // 1. Fetch the Public Message and Old Embed
            const channel = await interaction.guild.channels.fetch(submission.channelId);
            if (!channel) throw new Error('Channel not found');
            const message = await channel.messages.fetch(submission.messageId);
            if (!message) throw new Error('Message not found');
            const oldEmbed = message.embeds[0];

            // 2. Resolve Gender (DB > Embed > Default)
            let gender = submission.submissionData.gender;
            if (!gender) {
                const genderField = oldEmbed.fields.find(f => f.name === 'Gender');
                if (genderField) gender = genderField.value;
            }
            newData.gender = gender; // Ensure we save this back to DB

            // 3. Update Embed
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .setFields(
                    { name: 'Name', value: newData.name, inline: true },
                    { name: 'Age', value: newData.age, inline: true },
                    { name: 'Gender', value: newData.gender || 'Not specified', inline: true },
                    { name: 'Profession', value: newData.profession || 'Not specified', inline: true },
                    { name: 'Platform', value: newData.platform, inline: true },
                    { name: 'What do you do?', value: newData.game || 'Not specified', inline: false }
                );

            await message.edit({ embeds: [newEmbed] });

            // 4. Update Persistence
            await addSubmission(interaction.guild.id, targetUserId, {
                messageId: submission.messageId,
                channelId: submission.channelId,
                submissionData: newData
            });

            // Notify User via DM
            try {
                const targetMember = await interaction.guild.members.fetch(targetUserId);
                if (targetMember) {
                    await targetMember.send({
                        content: `⚠️ **Admin Action:** Your introduction in **${interaction.guild.name}** has been edited by an administrator.`
                    });
                }
            } catch (dmError) {
                console.warn(`Could not DM user ${targetUserId} after edit:`, dmError);
            }

            await interaction.editReply({ content: '✅ Introduction updated successfully! User has been notified.' });

            // Log Action
            const { logAction } = require('../../utils/logger');
            const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);

            logAction(interaction.client, interaction.guild.id, 'INTRO_EDIT', {
                user: targetUser || { tag: 'Unknown User', id: targetUserId },
                details: `Admin Edit by ${interaction.user}.`
            });

        } catch (error) {
            console.error('Error editing intro:', error);
            await interaction.editReply({ content: `❌ Failed to update introduction: ${error.message}` });
        }
    },
};
