const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { getConfig } = require('../../utils/serverConfig');
const { addSubmission, removeSubmission } = require('../../utils/persistence');

module.exports = {
    id: 'moderation_action',
    /**
     * @param {import('discord.js').ButtonInteraction} interaction 
     */
    async execute(interaction) {
        // 0. DO NOT Acknowledge immediately. 
        // We need to check the action first because we cannot showModal if we deferred.

        const serverConfig = getConfig(interaction.guild.id);
        const modRoleId = serverConfig.modRoleId;
        const subChannelId = serverConfig.submissionChannelId;

        // Check permissions
        if (modRoleId && !interaction.member.roles.cache.has(modRoleId)) {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({
                    content: '⛔ You do not have permission to moderate introductions.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // Safety: If no mod role is set, we fallback to Admin only, but we don't block logic yet.
        // However, if no subChannelId is set, we CANNOT proceed with approval.
        if (!subChannelId && (interaction.customId.startsWith('approve_btn_'))) {
            return interaction.reply({
                content: '⚠️ **Configuration Error:** Submission channel not set. Run `/setup` first.',
                flags: MessageFlags.Ephemeral
            });
        }

        const action = interaction.customId.startsWith('approve_btn_') ? 'approve' :
            interaction.customId.startsWith('edit_btn_') ? 'edit' : 'reject';
        const targetUserId = interaction.customId.split('_').pop();

        if (action === 'approve') {
            await interaction.deferUpdate();
            const submissionEmbed = interaction.message.embeds[0];

            // 1. Send to Public Channel
            let publicChannel = interaction.client.channels.cache.get(subChannelId);
            if (!publicChannel) {
                try {
                    publicChannel = await interaction.client.channels.fetch(subChannelId);
                } catch (error) {
                    console.error(`Failed to fetch Public Channel (${subChannelId}):`, error);
                }
            }

            if (!publicChannel) {
                return interaction.followUp({
                    content: '❌ Public submission channel not found/configured.',
                    flags: MessageFlags.Ephemeral
                });
            }

            try {
                const sentMessage = await publicChannel.send({ embeds: [submissionEmbed] });

                // 2. Mark User as Persistence (with Rich Data for Editing/Safety)
                // Reconstruct submission data from embed fields
                const fields = submissionEmbed.data.fields;
                const getValue = (name) => fields.find(f => f.name === name)?.value || '';

                const submissionData = {
                    name: getValue('Name'),
                    age: getValue('Age'),
                    gender: getValue('Gender'), // New Field
                    profession: getValue('Profession'),
                    platform: getValue('Platform'),
                    game: getValue('What do you do?') || getValue('Game') // Support both
                };

                await addSubmission(interaction.guild.id, targetUserId, {
                    messageId: sentMessage.id,
                    channelId: publicChannel.id,
                    submissionData: submissionData,
                    status: 'approved' // FINAL SAVED STATE
                });

                // --- Assign Roles (Approved + Gender) ---
                const targetMember = await interaction.guild.members.fetch(targetUserId);

                // 1. Approved Role
                const approvedRoleId = serverConfig.approvedRoleId;
                if (approvedRoleId) {
                    try {
                        await targetMember.roles.add(approvedRoleId);
                        console.log(`✅ Assigned approved role ${approvedRoleId} to ${targetMember.user.tag}`);
                    } catch (roleError) {
                        console.error(`Failed to assign approved role to ${targetUserId}:`, roleError);
                        await interaction.followUp({
                            content: `⚠️ Failed to assign Approved Role. Check bot hierarchy.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                // 2. Gender Role
                const gender = submissionData.gender;
                let genderRoleId = null;
                if (gender === 'Male') genderRoleId = serverConfig.maleRoleId;
                if (gender === 'Female') genderRoleId = serverConfig.femaleRoleId;


                if (genderRoleId) {
                    try {
                        await targetMember.roles.add(genderRoleId);
                        console.log(`✅ Assigned gender role ${genderRoleId} (${gender}) to ${targetMember.user.tag}`);
                    } catch (roleError) {
                        console.error(`Failed to assign gender role to ${targetUserId}:`, roleError);
                        await interaction.followUp({
                            content: `⚠️ Failed to assign Gender Role (${gender}). Check bot hierarchy.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                // 3. Update Admin Message
                const approvedEmbed = EmbedBuilder.from(submissionEmbed)
                    .setTitle('✅ Introduction Approved')
                    .setFooter({ text: `Approved by ${interaction.user.tag}`, iconURL: interaction.client.user.displayAvatarURL() })
                    .setColor(0x57F287); // Green

                await interaction.editReply({
                    content: `Approved by ${interaction.user}`,
                    embeds: [approvedEmbed],
                    components: []
                });

                // Notify User via DM
                try {
                    const targetMember = await interaction.guild.members.fetch(targetUserId);
                    if (targetMember) {
                        const { getLogoAttachment } = require('../../utils/notificationUtils');
                        const { attachment, url } = getLogoAttachment();

                        const { t } = require('../../utils/lang');
                        const guild = interaction.guild;

                        const dmEmbed = new EmbedBuilder()
                            .setTitle(t('moderation.dm_approved_title', guild.id))
                            .setDescription(t('moderation.dm_approved_desc', guild.id, { guild: guild.name }))
                            .setColor(0x57F287) // Green
                            .setTimestamp();

                        if (url) {
                            dmEmbed.setFooter({ text: 'Welcome aboard! 🚀', iconURL: url });
                        }

                        const payload = { embeds: [dmEmbed] };
                        if (attachment) payload.files = [attachment];

                        await targetMember.send(payload);
                    }
                } catch (dmError) {
                    console.warn(`Could not DM user ${targetUserId}:`, dmError);
                }

                // Log Approval
                const { logAction } = require('../../utils/logger');
                const { t } = require('../../utils/lang');
                logAction(interaction.client, interaction.guild.id, 'INTRO_STATUS', {
                    user: await interaction.client.users.fetch(targetUserId).catch(() => null),
                    details: t('moderation.approved_log', interaction.guild.id, { user: interaction.user })
                });

            } catch (err) {
                console.error(err);
                return interaction.followUp({
                    content: '❌ Error posting to public channel.',
                    flags: MessageFlags.Ephemeral
                });
            }

        } else if (action === 'reject') {
            await interaction.deferUpdate();
            // Reject Logic
            const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle('❌ Introduction Rejected')
                .setFooter({ text: `Rejected by ${interaction.user.tag}`, iconURL: interaction.client.user.displayAvatarURL() })
                .setColor(0xED4245); // Red

            await interaction.editReply({
                content: `Rejected by ${interaction.user}`,
                embeds: [rejectedEmbed],
                components: []
            });

            // CLEAR PERSISTENCE (Allow Retry)
            await removeSubmission(interaction.guild.id, targetUserId);

            // Notify User via DM
            try {
                const targetMember = await interaction.guild.members.fetch(targetUserId);
                if (targetMember) {
                    const { getLogoAttachment } = require('../../utils/notificationUtils');
                    const { attachment, url } = getLogoAttachment();

                    const { t } = require('../../utils/lang');
                    const guild = interaction.guild;

                    const dmEmbed = new EmbedBuilder()
                        .setTitle(t('moderation.dm_rejected_title', guild.id))
                        .setDescription(t('moderation.dm_rejected_desc', guild.id, { guild: guild.name }))
                        .setColor(0xED4245) // Red
                        .setTimestamp();

                    if (url) {
                        dmEmbed.setFooter({ text: 'We\'d love to hear from you again! ✨', iconURL: url });
                    }

                    const payload = { embeds: [dmEmbed] };
                    if (attachment) payload.files = [attachment];

                    await targetMember.send(payload);
                }
            } catch (dmError) {
                console.warn(`Could not DM user ${targetUserId}:`, dmError);
            }

            // Log Rejection
            const { logAction } = require('../../utils/logger');
            const { t } = require('../../utils/lang');
            logAction(interaction.client, interaction.guild.id, 'INTRO_STATUS', {
                user: await interaction.client.users.fetch(targetUserId).catch(() => null),
                details: t('moderation.rejected_log', interaction.guild.id, { user: interaction.user })
            });
        } else if (action === 'edit') {
            // Edit Logic - Show Modal with pre-filled values
            const embed = interaction.message.embeds[0];
            const fields = embed.data.fields;

            // Helper to get field value (Support both old "Game" and new "What do you do?")
            const getValue = (name) => {
                let field = fields.find(f => f.name === name);
                if (!field && name === 'What do you do?') {
                    // Fallback check for old "Game"
                    field = fields.find(f => f.name === 'Game');
                }
                return field ? field.value : '';
            };

            const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

            const modal = new ModalBuilder()
                .setCustomId(`editIntroModal_${targetUserId}`) // Pass targetUserId to modal
                .setTitle('Edit Introduction');

            const nameInput = new TextInputBuilder()
                .setCustomId('nameInput')
                .setLabel("What's your name?")
                .setStyle(TextInputStyle.Short)
                .setValue(getValue('Name'))
                .setMaxLength(50);

            const ageInput = new TextInputBuilder()
                .setCustomId('ageInput')
                .setLabel("How old are you?")
                .setStyle(TextInputStyle.Short)
                .setValue(getValue('Age'))
                .setMaxLength(3);

            const professionInput = new TextInputBuilder()
                .setCustomId('professionInput')
                .setLabel("What's your profession?")
                .setStyle(TextInputStyle.Short)
                .setValue(getValue('Profession'))
                .setMaxLength(50);

            const platformInput = new TextInputBuilder()
                .setCustomId('platformInput')
                .setLabel("Platform (PC, Console, Mobile)?")
                .setStyle(TextInputStyle.Short)
                .setValue(getValue('Platform'))
                .setMaxLength(50);

            const rawGameValue = getValue('What do you do?') || getValue('Game') || '';
            const gameValue = rawGameValue.length >= 11 ? rawGameValue : '';
            const gamePlaceholder = rawGameValue.length < 11 && rawGameValue.length > 0 ? `Previous: ${rawGameValue}` : 'What do you do?';

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
        }
    },
};
