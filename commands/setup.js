const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags, ChannelType, EmbedBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { getConfig, saveConfig } = require('../utils/serverConfig');
const { getLogoAttachment } = require('../utils/notificationUtils');
const { t } = require('../utils/lang');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Automatic Wizard: Creates channels/roles (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to give on approval (Default: "Approved")')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('role_male')
                .setDescription('Role to give for Gender: Male (Default: "Male")')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('role_female')
                .setDescription('Role to give for Gender: Female (Default: "Female")')
                .setRequired(true)
        )

        .addStringOption(option =>
            option.setName('color')
                .setDescription('Hex color for the embed (e.g. #FF0000)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('embed_title')
                .setDescription('Custom title for the introduction embed')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('embed_desc')
                .setDescription('Custom description for the introduction embed')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('embed_footer')
                .setDescription('Custom footer text')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('reset_defaults')
                .setDescription('Reset Title/Desc/Footer to defaults')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = interaction.guild;

        // Log Groups
        const logs = {
            general: [],
            objects: [], // Channels/Roles created
            config: [],
            errors: []
        };
        const addLog = (category, msg) => logs[category].push(msg);

        const currentConfig = getConfig(guild.id);
        const settingsToSave = { ...currentConfig };

        // Handle Reset Defaults
        if (interaction.options.getBoolean('reset_defaults')) {
            delete settingsToSave.customPromptTitle;
            delete settingsToSave.customPromptDesc;
            delete settingsToSave.customPromptFooter;
            addLog('config', '🔄 Reset Title, Description, and Footer to defaults.');
        }

        // --- ROLE HANDLING (AUTO-CREATE DEFAULTS) ---

        // Helper: Find or Create Role
        const ensureRole = async (optionName, roleName, configKey, color) => {
            const inputRole = interaction.options.getRole(optionName);
            if (inputRole) {
                settingsToSave[configKey] = inputRole.id;
                addLog('config', `👤 ${roleName} Role set to: ${inputRole}`);
                return;
            }

            // Check config first
            let roleId = currentConfig[configKey];
            let role = roleId ? guild.roles.cache.get(roleId) : null;

            // Check by name if not in config
            if (!role) {
                role = guild.roles.cache.find(r => r.name === roleName);
            }

            if (!role) {
                try {
                    role = await guild.roles.create({
                        name: roleName,
                        color: color || 0x99AAB5,
                        reason: 'Intro Creg Setup: Auto-created role'
                    });
                    addLog('objects', `✅ Created Role: ${role}`);
                } catch (err) {
                    addLog('errors', `⚠️ Failed to create '${roleName}' role: ${err.message}`);
                    return;
                }
            } else {
                // addLog('objects', `ℹ️ Found Role: ${role}`);
            }

            settingsToSave[configKey] = role.id;
        };

        // 1. Approved Role
        await ensureRole('role', 'Approved', 'approvedRoleId', 0x57F287); // Green

        // 2. Male Role
        await ensureRole('role_male', 'Male', 'maleRoleId', 0x3498DB); // Blue

        // 3. Female Role
        await ensureRole('role_female', 'Female', 'femaleRoleId', 0xE91E63); // Pink



        // Handle Color Input
        const colorInput = interaction.options.getString('color');
        if (colorInput) {
            // Simple hex validation
            const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
            if (hexRegex.test(colorInput)) {
                settingsToSave.embedColor = colorInput;
                addLog('config', `🎨 Embed Color set to: ${colorInput}`);
            } else {
                addLog('errors', `⚠️ Invalid Hex Color provided (${colorInput}). Using default.`);
            }
        }

        // Handle Custom Embed Text
        const customTitle = interaction.options.getString('embed_title');
        if (customTitle) {
            settingsToSave.customPromptTitle = customTitle;
            addLog('config', `📝 Custom Title set.`);
        }

        const customDesc = interaction.options.getString('embed_desc');
        if (customDesc) {
            settingsToSave.customPromptDesc = customDesc;
            addLog('config', `📝 Custom Description set.`);
        }

        const customFooter = interaction.options.getString('embed_footer');
        if (customFooter) {
            settingsToSave.customPromptFooter = customFooter;
            addLog('config', `📝 Custom Footer set.`);
        }

        try {
            // 0. Create/Find Category "Intro Creg"
            let category = guild.channels.cache.find(c => c.name === 'Intro Creg' && c.type === ChannelType.GuildCategory);
            if (!category) {
                category = await guild.channels.create({
                    name: 'Intro Creg',
                    type: ChannelType.GuildCategory,
                });
                addLog('objects', `✅ Created Category: ${category.name}`);
            }
            settingsToSave.categoryId = category.id;

            // 1. Admin/Log Channel (intro-approvals)
            let adminChannel = guild.channels.cache.get(currentConfig.adminChannelId) ||
                guild.channels.cache.find(c => c.name === 'intro-approvals');

            if (!adminChannel) {
                adminChannel = await guild.channels.create({
                    name: 'intro-approvals',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [{
                        id: guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel],
                    }],
                });
                addLog('objects', `✅ Created Log Channel: ${adminChannel}`);
            } else {
                if (adminChannel.parentId !== category.id) {
                    await adminChannel.setParent(category.id, { lockPermissions: false });
                    addLog('objects', `➡️ Moved Log Channel to Category`);
                }
                await adminChannel.permissionOverwrites.edit(guild.id, { ViewChannel: false });
            }
            settingsToSave.adminChannelId = adminChannel.id;

            // 1.5. Log Channel (mod-logs)
            let logChannel = guild.channels.cache.get(currentConfig.logChannelId) ||
                guild.channels.cache.find(c => c.name === 'mod-logs');

            if (!logChannel) {
                logChannel = await guild.channels.create({
                    name: 'mod-logs',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [{
                        id: guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel],
                    }],
                });
                addLog('objects', `✅ Created Log Channel: ${logChannel}`);
            } else {
                if (logChannel.parentId !== category.id) {
                    await logChannel.setParent(category.id, { lockPermissions: false });
                }
                await logChannel.permissionOverwrites.edit(guild.id, { ViewChannel: false });
            }
            settingsToSave.logChannelId = logChannel.id;

            // 2. Submission Feed Channel (introductions)
            let feedChannel = guild.channels.cache.get(currentConfig.submissionChannelId) ||
                guild.channels.cache.find(c => c.name === 'introductions');

            if (!feedChannel) {
                feedChannel = await guild.channels.create({
                    name: 'introductions',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [{
                        id: guild.id, // @everyone
                        deny: [PermissionFlagsBits.SendMessages], // Block users from sending
                    }],
                });
                addLog('objects', `✅ Created Feed Channel: ${feedChannel}`);
            } else {
                if (feedChannel.parentId !== category.id) {
                    await feedChannel.setParent(category.id, { lockPermissions: false });
                    addLog('objects', `➡️ Moved Feed Channel to Category`);
                }
                await feedChannel.permissionOverwrites.edit(guild.id, { SendMessages: false });
            }
            settingsToSave.submissionChannelId = feedChannel.id;

            // 3. Prompt/Embed Channel (fill-introductions)
            let promptChannel = guild.channels.cache.get(currentConfig.promptChannelId) ||
                guild.channels.cache.find(c => c.name === 'fill-introductions');

            if (!promptChannel) {
                promptChannel = await guild.channels.create({
                    name: 'fill-introductions',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [{
                        id: guild.id,
                        deny: [PermissionFlagsBits.SendMessages],
                    }],
                });
                addLog('objects', `✅ Created Prompt Channel: ${promptChannel}`);
            } else {
                if (promptChannel.parentId !== category.id) {
                    await promptChannel.setParent(category.id, { lockPermissions: false });
                    addLog('objects', `➡️ Moved Prompt Channel to Category`);
                }
                await promptChannel.permissionOverwrites.edit(guild.id, { SendMessages: false });
            }
            settingsToSave.promptChannelId = promptChannel.id;

            // 4. Moderator Role (ModIntro)
            let modRole = guild.roles.cache.get(currentConfig.modRoleId) ||
                guild.roles.cache.find(r => r.name === 'ModIntro');

            if (!modRole) {
                try {
                    modRole = await guild.roles.create({
                        name: 'ModIntro',
                        color: 0x5865F2, // Blurple
                        permissions: [
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ModerateMembers,
                            PermissionFlagsBits.ViewAuditLog
                        ],
                    });
                    await adminChannel.permissionOverwrites.create(modRole, { ViewChannel: true });
                    addLog('objects', `✅ Created Role: ${modRole}`);
                } catch (err) {
                    addLog('errors', `⚠️ **Failed to create 'ModIntro' role**: ${err.message}. Check permissions.`);
                }
            } else {
                if (modRole.editable) {
                    try {
                        await modRole.setPermissions([
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ModerateMembers,
                            PermissionFlagsBits.ViewAuditLog
                        ]);
                        addLog('objects', `🔄 Updated Permissions for ${modRole}`);
                    } catch (err) {
                        addLog('errors', `⚠️ Failed to update ${modRole} permissions: ${err.message}`);
                    }
                } else {
                    addLog('errors', `⚠️ **Skipped Role Update**: ${modRole} is higher than my role.`);
                }
            }
            if (modRole) {
                settingsToSave.modRoleId = modRole.id;
            }

            // Save Config
            saveConfig(guild.id, settingsToSave);
            addLog('general', '💾 Configuration saved to file.');

            // 5. Post Embed to Prompt Channel
            const { attachment, url } = getLogoAttachment();

            const titleText = settingsToSave.customPromptTitle || t('setup.prompt_title', guild.id);
            const descText = settingsToSave.customPromptDesc || t('setup.prompt_desc', guild.id);
            const footerText = settingsToSave.customPromptFooter || t('setup.prompt_footer', guild.id);

            const embed = new EmbedBuilder()
                .setTitle(titleText)
                .setDescription(descText)
                .setColor(settingsToSave.embedColor || 0xFF00FA)
                .setFooter({ text: footerText, iconURL: interaction.client.user.displayAvatarURL() });

            if (url) {
                embed.setAuthor({ name: 'Intro Creg', iconURL: url });
            } else {
                embed.setAuthor({ name: 'Intro Creg', iconURL: interaction.client.user.displayAvatarURL() });
            }

            const button = new ButtonBuilder()
                .setCustomId('intro_submit_btn')
                .setLabel(t('setup.btn_label', guild.id) || 'Introduce Yourself')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝');

            const row = new ActionRowBuilder().addComponents(button);

            const payload = { embeds: [embed], components: [row] };
            if (attachment) payload.files = [attachment];

            await promptChannel.send(payload);
            addLog('general', `✅ Introduction Prompt posted to ${promptChannel}`);

            // --- STANDARD ADMIN RESPONSE (Default / Original Style) ---
            const summaryEmbed = new EmbedBuilder()
                .setTitle('Setup Completed')
                .setColor(logs.errors.length > 0 ? 0xE67E22 : 0x57F287) // Orange or Green
                .setDescription(`Setup finished for **${guild.name}**.\n\n**Objects Created:**\n${logs.objects.length ? logs.objects.map(l => `- ${l}`).join('\n') : 'No new objects.'}\n\n**Errors:**\n${logs.errors.length ? logs.errors.join('\n') : 'None'}`)
                .setFooter({ text: 'Intro Creg Setup' })
                .setTimestamp();

            await interaction.editReply({ embeds: [summaryEmbed] });

        } catch (error) {
            console.error(error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Setup Failed')
                .setDescription(`Error:\n\`\`\`\n${error.message}\n\`\`\``)
                .setColor(0xED4245);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
