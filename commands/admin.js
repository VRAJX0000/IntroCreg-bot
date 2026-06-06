const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getSubmission, removeSubmission } = require('../utils/persistence');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin tools for managing introductions')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-intro')
                .setDescription('Delete a user\'s introduction and allow them to resubmit')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to reset')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit-intro')
                .setDescription('Edit an approved introduction')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to edit')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit-gender')
                .setDescription('Change the gender of an approved introduction')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to edit')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto-approve')
                .setDescription('Toggle auto-approve mode for introductions')
                .addStringOption(option =>
                    option.setName('state')
                        .setDescription('Turn auto-approve ON or OFF')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ON', value: 'on' },
                            { name: 'OFF', value: 'off' }
                        )
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        const guildId = interaction.guild.id;

        if (subcommand === 'reset-intro') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const submission = await getSubmission(guildId, targetUser.id);
            if (!submission) {
                return interaction.editReply({ content: `❌ No submission found for ${targetUser}.` });
            }

            // Try to delete the public message if we have the ID
            if (submission.channelId && submission.messageId) {
                try {
                    const channel = await interaction.guild.channels.fetch(submission.channelId);
                    if (channel) {
                        const message = await channel.messages.fetch(submission.messageId);
                        if (message) {
                            await message.delete();
                        }
                    }
                } catch (err) {
                    // Ignore Unknown Message (10008) and Unknown Channel (10003) errors
                    if (err.code !== 10008 && err.code !== 10003) {
                        console.warn(`Could not delete message for ${targetUser.tag}:`, err);
                    }
                    // Continue anyway to reset the persistence
                }
            }

            // Remove from persistence
            await removeSubmission(guildId, targetUser.id);

            // Notify User via DM
            try {
                const targetMember = await interaction.guild.members.fetch(targetUser.id);
                if (targetMember) {
                    await targetMember.send({
                        content: `⚠️ **Admin Action:** Your introduction in **${interaction.guild.name}** has been reset by an administrator.\n\nYou may now submit a new introduction.`
                    });
                }
            } catch (dmError) {
                console.warn(`Could not DM user ${targetUser.tag} after reset:`, dmError);
            }

            // Log Action
            const { logAction } = require('../utils/logger');
            logAction(interaction.client, guildId, 'MOD_ACTION', {
                user: interaction.user,
                details: `Reset introduction for ${targetUser}.`,
                fields: [
                    { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: true }
                ]
            });

            const { EmbedBuilder } = require('discord.js');
            const successEmbed = new EmbedBuilder()
                .setDescription(`✅ Reset complete for ${targetUser}.\n\n- Database record deleted.\n- Public post deleted (if found).\n- User has been notified via DM.`)
                .setColor(0x57F287); // Green

            return interaction.editReply({
                content: '',
                embeds: [successEmbed]
            });

        } else if (subcommand === 'edit-intro') {
            // Check if submission exists
            const submission = await getSubmission(guildId, targetUser.id);
            if (!submission) {
                return interaction.reply({
                    content: `❌ No submission found for ${targetUser}. They must have an approved intro to edit.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Open Modal with existing values
            // We'll store the targetUserId in the customId so the modal handler knows who we are editing
            const modal = new ModalBuilder()
                .setCustomId(`adminEditModal_${targetUser.id}`)
                .setTitle(`Edit Intro: ${targetUser.username}`);

            // Use stored data if available, otherwise empty (fallback for old data)
            const data = submission.submissionData || {};
            if (!data || Object.keys(data).length === 0) { // Check if data is truly empty or missing expected content
                console.error("ADMIN EDIT: submissionData is missing or invalid", submission);
                return interaction.reply({ content: '❌ Debug: Submission data corrupted (missing submissionData).', flags: MessageFlags.Ephemeral });
            }
            console.log("ADMIN EDIT: Loaded data:", data);

            const nameInput = new TextInputBuilder()
                .setCustomId('nameInput')
                .setLabel("Name")
                .setStyle(TextInputStyle.Short)
                .setValue(data.name || '')
                .setMaxLength(50);

            const ageInput = new TextInputBuilder()
                .setCustomId('ageInput')
                .setLabel("Age")
                .setStyle(TextInputStyle.Short)
                .setValue(data.age || '')
                .setMaxLength(3);

            const professionInput = new TextInputBuilder()
                .setCustomId('professionInput')
                .setLabel("Profession")
                .setStyle(TextInputStyle.Short)
                .setValue(data.profession || '')
                .setMaxLength(50);

            const platformInput = new TextInputBuilder()
                .setCustomId('platformInput')
                .setLabel("Platform")
                .setStyle(TextInputStyle.Short)
                .setValue(data.platform || '')
                .setMaxLength(50);

            const gameValue = (data.game && data.game.length >= 11) ? data.game : '';
            const gamePlaceholder = (data.game && data.game.length < 11) ? `Previous: ${data.game}` : 'What do you do?';

            const gameInput = new TextInputBuilder()
                .setCustomId('gameInput')
                .setLabel("What do you do?")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(gamePlaceholder)
                .setMinLength(11)
                .setMaxLength(50);

            if (gameValue) {
                gameInput.setValue(gameValue);
            }

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(ageInput),
                new ActionRowBuilder().addComponents(professionInput),
                new ActionRowBuilder().addComponents(platformInput),
                new ActionRowBuilder().addComponents(gameInput),
            );

            await interaction.showModal(modal);

        } else if (subcommand === 'edit-gender') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Check if submission exists
            const submission = await getSubmission(guildId, targetUser.id);
            if (!submission) {
                return interaction.editReply({
                    content: `❌ No submission found for ${targetUser}.`
                });
            }

            // Show Select Menu
            const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

            const select = new StringSelectMenuBuilder()
                .setCustomId(`admin_gender_select_${targetUser.id}`) // Encode target user ID
                .setPlaceholder('Select new gender')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Male').setEmoji('👨').setValue('Male'),
                    new StringSelectMenuOptionBuilder().setLabel('Female').setEmoji('👩').setValue('Female'),

                );

            const row = new ActionRowBuilder().addComponents(select);

            await interaction.editReply({
                content: `Select a new gender for **${targetUser.tag}**:`,
                components: [row]
            });

        } else if (subcommand === 'auto-approve') {
            const state = interaction.options.getString('state');
            const { setConfig } = require('../utils/serverConfig');

            const isEnabled = state === 'on';
            setConfig(guildId, 'autoApprove', isEnabled);

            const statusText = isEnabled ? '✅ **Auto-Approve is now ON**' : '🚫 **Auto-Approve is now OFF**';
            const descText = isEnabled
                ? 'Introductions will be posted publicly **immediately** without moderator review.'
                : 'Introductions will require manual approval by a moderator.';

            await interaction.reply({
                content: `${statusText}\n${descText}`,
                flags: MessageFlags.Ephemeral
            });

            const { logAction } = require('../utils/logger');
            logAction(interaction.client, guildId, 'CONFIG_UPDATE', {
                user: interaction.user,
                details: `Auto-Approve toggled **${state.toUpperCase()}**.`,
                fields: [
                    { name: 'New State', value: isEnabled ? 'Enabled' : 'Disabled', inline: true }
                ]
            });
        }
    },
};
