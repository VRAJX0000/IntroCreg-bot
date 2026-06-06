const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes, MessageFlags, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('./config');



const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();

// --- Load Commands ---
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// --- Load Interactions ---
// Buttons
const buttonsPath = path.join(__dirname, 'interactions', 'buttons');
if (fs.existsSync(buttonsPath)) {
    const buttonFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'));
    for (const file of buttonFiles) {
        const filePath = path.join(buttonsPath, file);
        const button = require(filePath);
        if ('id' in button && 'execute' in button) {
            client.buttons.set(button.id, button);
        }
    }
}

// Modals
const modalsPath = path.join(__dirname, 'interactions', 'modals');
if (fs.existsSync(modalsPath)) {
    const modalFiles = fs.readdirSync(modalsPath).filter(file => file.endsWith('.js'));
    for (const file of modalFiles) {
        const filePath = path.join(modalsPath, file);
        const modal = require(filePath);
        if ('id' in modal && 'execute' in modal) {
            client.modals.set(modal.id, modal);
        }
    }
}

// Select Menus
client.selectMenus = new Collection();
const selectMenusPath = path.join(__dirname, 'interactions', 'selectMenus');
if (fs.existsSync(selectMenusPath)) {
    const selectMenuFiles = fs.readdirSync(selectMenusPath).filter(file => file.endsWith('.js'));
    for (const file of selectMenuFiles) {
        const filePath = path.join(selectMenusPath, file);
        const selectMenu = require(filePath);
        if ('id' in selectMenu && 'execute' in selectMenu) {
            client.selectMenus.set(selectMenu.id, selectMenu);
        }
    }
}

// --- Event Handlers ---

client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

    // Register Commands
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Using applicationCommands(clientId) to register globally. 
        // For faster dev, normally guild commands are used, but for "run immediately" global is easier locally if single server.
        // Actually, let's just register to all guilds the bot is in to be safe/lazy, or just global.
        // Global takes time to propagate, but works.
        const data = await rest.put(
            Routes.applicationCommands(c.user.id),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }

    // --- Persistence Init ---
    const { initPersistence } = require('./utils/persistence');

    await initPersistence();

    // --- Automatic Log Channel Creation ---
    // REMOVED: Managed by /setup command now.
});





// --- Logger ---
const { logAction } = require('./utils/logger');

// --- Rate Limiter ---
const rateLimiter = require('./utils/rateLimiter');

client.on(Events.InteractionCreate, async interaction => {
    // Gloabl Rate Limit Check
    // 3 seconds cooldown for Buttons and Commands to prevent spam/ddos
    // EXCEPTION: Help menu buttons (navigation should be fast)
    let isHelpNav = interaction.customId && interaction.customId.startsWith('help_');
    const remaining = !isHelpNav ? rateLimiter.check(interaction.user.id, 'global_interaction', 3) : 0;

    if (remaining > 0) {
        // We reply ephemerally and RETURN, stopping all processing (DB calls, logic, etc.)
        const seconds = (remaining / 1000).toFixed(1);
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: `⏳ **Slow down!** You are doing that too fast. Wait ${seconds}s.`, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: `⏳ **Slow down!** You are doing that too fast. Wait ${seconds}s.`, flags: MessageFlags.Ephemeral });
            }
        } catch (e) { /* Ignore if interaction closed */ }
        return;
    }

    // Global DM Check (Double Safety)
    if (!interaction.guild) {
        return interaction.reply({
            content: '🚫 **System Alert:** Direct Messages are disabled for this bot. Please use commands in a server.',
            flags: MessageFlags.Ephemeral
        }).catch(() => { });
    }

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            // Ignore "Unknown interaction" or "Already acknowledged" errors (common in laggy envs)
            if (error.code === 10062 || error.code === 40060) return;

            console.error(error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            }
        }
        return;
    }

    // 2. Buttons
    if (interaction.isButton()) {
        const button = interaction.client.buttons.get(interaction.customId);

        // Check for static button handler
        if (button) {
            try {
                await button.execute(interaction);
            } catch (error) {
                if (error.code === 10062 || error.code === 40060) return;
                console.error(error);

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Error processing button!', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: 'Error processing button!', flags: MessageFlags.Ephemeral });
                }
            }
            return;
        }

        // Check for dynamic moderation buttons (approve_btn_USERID, reject_btn_USERID, edit_btn_USERID)
        if (interaction.customId.startsWith('approve_btn_') || interaction.customId.startsWith('reject_btn_') || interaction.customId.startsWith('edit_btn_')) {
            const modHandler = require('./interactions/buttons/moderationButtons.js');
            try {
                await modHandler.execute(interaction);
            } catch (error) {
                // Ignore "Unknown interaction" or "Already acknowledged" errors
                if (error.code === 10062 || error.code === 40060) return;

                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Error processing moderation action!', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: 'Error processing moderation action!', flags: MessageFlags.Ephemeral });
                }
            }
            return;
        }



        // Check for Help Menu navigation (handled by collector in help.js)
        if (interaction.customId.startsWith('help_') || interaction.customId.startsWith('setup_')) return;

        console.warn(`No handler for button ID: ${interaction.customId}`);
        return;
    }

    // 3. Modals
    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        // Exact match
        let modal = interaction.client.modals.get(customId);

        // Dynamic match
        if (!modal) {
            if (customId.startsWith('adminEditModal_')) {
                modal = interaction.client.modals.get('adminEditModal');
            } else if (customId.startsWith('editIntroModal_')) { // Fix for Edit Persistance
                modal = interaction.client.modals.get('editIntroModal');
            }
        }

        if (!modal) {
            console.warn(`No handler for modal ID: ${customId}`);
            return;
        }

        try {
            await modal.execute(interaction);
        } catch (error) {
            if (error.code === 10062 || error.code === 40060) return;
            console.error(error);

            // Verify if already replied
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error processing modal!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'Error processing modal!', flags: MessageFlags.Ephemeral });
            }
        }
        return;
    }

    // 4. Select Menus
    if (interaction.isStringSelectMenu()) {
        let selectMenu = interaction.client.selectMenus.get(interaction.customId);

        // Fallback: Check for dynamic IDs (e.g. admin_gender_select_USERID)
        if (!selectMenu) {
            selectMenu = interaction.client.selectMenus.find((handler, key) => interaction.customId.startsWith(key));
        }

        if (!selectMenu) {
            // Ignore setup command interactive menus
            if (interaction.customId.startsWith('setup_')) return;

            console.warn(`No handler for select menu ID: ${interaction.customId}`);
            return;
        }

        try {
            await selectMenu.execute(interaction);
        } catch (error) {
            if (error.code === 10062 || error.code === 40060) return;
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error processing select menu!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'Error processing select menu!', flags: MessageFlags.Ephemeral });
            }
        }
    }
});

// --- Server Join Handler (Auto-Invite) ---
client.on(Events.GuildCreate, async guild => {
    console.log(`Joined new guild: ${guild.name}`);

    // Find a channel to create an invite
    let channel = guild.systemChannel;
    if (!channel || !channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite)) {
        channel = guild.channels.cache.find(c =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite) &&
            c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ViewChannel)
        );
    }

    if (channel) {
        try {
            const invite = await channel.createInvite({
                maxAge: 0, // Permanent
                maxUses: 0 // Unlimited
            });
            const inviteInfo = `Server: ${guild.name} | ID: ${guild.id} | Invite: ${invite.url}\n`;

            // Append to file
            const invitesPath = path.join(__dirname, 'server_invites.txt');
            fs.appendFileSync(invitesPath, inviteInfo);
            console.log(`✅ Created invite for ${guild.name} -> server_invites.txt`);
        } catch (err) {
            console.error(`Failed to create invite for ${guild.name}:`, err);
        }
    } else {
        console.warn(`Could not find a channel to create invite for ${guild.name}`);
    }
});

// --- Server Leave / Kick / Ban Cleanup ---
const { deleteSubmission } = require('./utils/submissionUtils');

// 1. Member Joined
client.on(Events.GuildMemberAdd, async member => {
    // Welcome Message
    const { getConfig } = require('./utils/serverConfig');
    const { createEmbed } = require('./utils/embedBuilder');
    const path = require('path');
    const guildId = member.guild.id;
    const config = getConfig(guildId);

    if (config.welcomeEnabled && config.welcomeChannelId) {
        const channel = member.guild.channels.cache.get(config.welcomeChannelId);
        if (channel) {
            const { generateWelcomeImage } = require('./utils/welcomeImageGenerator');

            try {
                const imageBuffer = await generateWelcomeImage(member);
                const attachment = { attachment: imageBuffer, name: 'welcome.png' };

                let welcomeMsg = config.welcomeMessage || `𝚆𝙴𝙻𝙲𝙾𝙼𝙴 𝚃𝙷𝙰𝙽𝙺𝚂 𝙵𝙾𝚁 𝙹𝙾𝙸𝙽𝙸𝙽𝙶 ${member}! ${member.guild.name}`;
                welcomeMsg = welcomeMsg.replace(/{user}/g, member).replace(/{server}/g, member.guild.name).replace(/\${member}/g, member);

                await channel.send({
                    content: welcomeMsg,
                    files: [attachment]
                });
            } catch (err) {
                console.error(`Failed to send welcome message in ${member.guild.name}:`, err);
            }
        }
    }

    logAction(client, member.guild.id, 'USER_JOIN', {
        user: member.user,
        details: `${member} joined the server.`,
        fields: [{ name: 'Account Created', value: member.user.createdAt.toLocaleDateString(), inline: true }]
    });
});

// 2. Member Leaves or Kicked
client.on(Events.GuildMemberRemove, async member => {
    console.log(`User left/kicked from guild: ${member.user.tag} (${member.id})`);
    await deleteSubmission(client, member.guild.id, member.id);

    logAction(client, member.guild.id, 'USER_LEAVE', {
        user: member.user,
        details: `${member.user.tag} left the server.`
    });
});

// 3. Member Banned (Redundant if Remove fires, but good for explicit tracking)
client.on(Events.GuildBanAdd, async ban => {
    console.log(`User banned from guild: ${ban.user.tag} (${ban.user.id})`);
    await deleteSubmission(client, ban.guild.id, ban.user.id);

    logAction(client, ban.guild.id, 'USER_LEAVE', {
        user: ban.user,
        details: `${ban.user.tag} was banned from the server.`
    });
});


// --- Global Error Handlers ---

// --- Global & Client Error Handlers ---

client.on('error', error => {
    console.error('Discord Client Error:', error);
});

client.on('shardError', error => {
    console.error('WebSocket Connection Error:', error);
});

// Load Anti-Crash Module
require('./utils/antiCrash')(client);

// Safe Login
(async () => {
    try {
        await client.login(config.token);
    } catch (error) {
        console.error('❌ Failed to login:', error);
    }
})();
