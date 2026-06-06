const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { setConfig, getConfig } = require('../utils/serverConfig');
const { createEmbed } = require('../utils/embedBuilder');
const { logAction } = require('../utils/logger');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the Welcome System')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the channel for welcome messages')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel from the list')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('channel_id')
                        .setDescription('Or enter the Channel ID manually')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('message')
                .setDescription('Set a custom welcome message')
                .addStringOption(option =>
                    option.setName('content')
                        .setDescription('The message content. Use {user} and {server} as placeholders.')
                        .setDescription('The message content. Use {user} and {server} as placeholders.')
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option.setName('reset_defaults')
                        .setDescription('Reset to default welcome message')
                        .setRequired(false)
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('off')
                .setDescription('Disable welcome messages')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Send a test welcome message to the configured channel')
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'set') {
            let channel = interaction.options.getChannel('channel');
            const channelIdInput = interaction.options.getString('channel_id');

            if (!channel && channelIdInput) {
                // Try to resolve channel from ID
                channel = interaction.guild.channels.cache.get(channelIdInput);
            }

            if (!channel) {
                return interaction.reply({
                    content: '⚠️ **Error:** You must provide either a valid `channel` or `channel_id`.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (channel.type !== ChannelType.GuildText) {
                return interaction.reply({
                    content: '⚠️ **Error:** The valid channel must be a Text Channel.',
                    flags: MessageFlags.Ephemeral
                });
            }

            setConfig(guildId, 'welcomeChannelId', channel.id);
            setConfig(guildId, 'welcomeEnabled', true);

            await interaction.reply({
                content: `✅ **Welcome Channel Set!**\nNew members will be welcomed in ${channel}.`,
                flags: MessageFlags.Ephemeral
            });

            logAction(interaction.client, guildId, 'CONFIG_UPDATE', {
                user: interaction.user,
                details: `Welcome channel set to ${channel.name} (${channel.id}).`
            });

        } else if (subcommand === 'message') {
            const message = interaction.options.getString('content');
            const resetDefaults = interaction.options.getBoolean('reset_defaults');

            if (resetDefaults) {
                // Remove custom message from config (reverting to code default)
                const currentConfig = getConfig(guildId);
                const newConfig = { ...currentConfig };
                delete newConfig.welcomeMessage;

                // We need to save the modified object manually since setConfig usually takes key/value
                const { saveConfig } = require('../utils/serverConfig');
                saveConfig(guildId, newConfig);

                await interaction.reply({
                    content: '🔄 **Welcome Message Reset!**\nIt has been reverted to the default system message.',
                    flags: MessageFlags.Ephemeral
                });
                logAction(interaction.client, guildId, 'CONFIG_UPDATE', {
                    user: interaction.user,
                    details: `Welcome message reset to default.`
                });
                return;
            }

            if (!message) {
                return interaction.reply({
                    content: '⚠️ **Error:** You must provide `content` or select `reset_defaults`.',
                    flags: MessageFlags.Ephemeral
                });
            }

            setConfig(guildId, 'welcomeMessage', message);

            await interaction.reply({
                content: `✅ **Welcome Message Updated!**\nPreview: ${message.replace(/{user}/g, interaction.user).replace(/{server}/g, interaction.guild.name).replace(/\${member}/g, interaction.user)}`,
                flags: MessageFlags.Ephemeral
            });

            logAction(interaction.client, guildId, 'CONFIG_UPDATE', {
                user: interaction.user,
                details: `Welcome message updated.`
            });

        } else if (subcommand === 'off') {
            setConfig(guildId, 'welcomeEnabled', false);
            await interaction.reply({
                content: '🚫 **Welcome Messages Disabled.**',
                flags: MessageFlags.Ephemeral
            });
            logAction(interaction.client, guildId, 'CONFIG_UPDATE', {
                user: interaction.user,
                details: `Welcome messages disabled.`
            });

        } else if (subcommand === 'test') {
            const config = getConfig(guildId);
            if (!config.welcomeChannelId) {
                return interaction.reply({
                    content: '⚠️ No welcome channel configured. Use `/welcome set` first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const channel = interaction.guild.channels.cache.get(config.welcomeChannelId);
            if (!channel) {
                return interaction.reply({
                    content: '⚠️ Configured channel not found. Please set it again.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Simulate Welcome Message
            const member = interaction.member;

            try {
                const { generateWelcomeImage } = require('../utils/welcomeImageGenerator');
                const imageBuffer = await generateWelcomeImage(member);
                const attachment = { attachment: imageBuffer, name: 'welcome.png' };

                let welcomeMsg = config.welcomeMessage || `𝚆𝙴𝙻𝙲𝙾𝙼𝙴 𝚃𝙷𝙰𝙽𝙺𝚂 𝙵𝙾𝚁 𝙹𝙾𝙸𝙽𝙸𝙽𝙶 ${member}! ${channel.guild.name}`;
                welcomeMsg = welcomeMsg.replace(/{user}/g, member).replace(/{server}/g, channel.guild.name).replace(/\${member}/g, member);

                await channel.send({
                    content: welcomeMsg,
                    files: [attachment]
                });
                await interaction.editReply(`✅ Test message sent to ${channel}!`);
            } catch (err) {
                console.error(err);
                await interaction.editReply(`❌ Failed to send test message: ${err.message}`);
            }
        }
    },
};
