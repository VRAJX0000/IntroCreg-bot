const { EmbedBuilder, WebhookClient } = require('discord.js');
const { getConfig } = require('./serverConfig');

/**
 * Robust Anti-Crash Module
 * @param {import('discord.js').Client} client 
 */
module.exports = (client) => {
    // 1. Unhandled Promise Rejection
    process.on('unhandledRejection', (reason, p) => {
        console.log(' [AntiCrash] :: Unhandled Rejection/Catch');
        console.log(reason, p);

        logCrash(client, 'Unhandled Rejection/Catch', reason);
    });

    // 2. Uncaught Exception
    process.on('uncaughtException', (err, origin) => {
        console.log(' [AntiCrash] :: Uncaught Exception/Catch');
        console.log(err, origin);

        logCrash(client, 'Uncaught Exception/Catch', err);
    });

    // 3. Uncaught Exception Monitor
    process.on('uncaughtExceptionMonitor', (err, origin) => {
        console.log(' [AntiCrash] :: Uncaught Exception/Catch (MONITOR)');
        console.log(err, origin);

        logCrash(client, 'Uncaught Exception/Catch (MONITOR)', err);
    });

    // 4. Multiple Resolves - DEPRECATED in Node 17+
    // process.on('multipleResolves', (type, promise, reason) => {
    //     // console.log(' [AntiCrash] :: Multiple Resolves');
    //     // console.log(type, promise, reason);
    //     // Usually harmless, but can be logged if needed.
    // });

    // --- Helper: Log to Discord ---
    async function logCrash(client, type, error) {
        if (!client || !client.isReady()) return;

        // Try to find a reporting channel
        // Strategy: Use a hardcoded Dev/Support Server channel OR the first guild's 'mod-logs'
        // For this specific bot, we can loop through guilds and log to "logChannelId" of the first valid config found?
        // OR better: Create a specific webhook for crash logs (Best Practice), but we don't have that setup.
        // Fallback: Log to ALL configured log channels (might be spammy) or just the first one found.

        try {
            // Find ANY valid log channel from connected guilds
            // This is a "global" crash, so it's irrelevant to a specific guild, but we want the OWNER to see it.
            // Let's assume the first guild in cache with a log channel is the "Main" server.

            // Or better, use the Developer IDs from config to maybe DM? (DMs can fail if closed).
            // Let's stick to log channel.

            // Get all guild IDs
            const guilds = client.guilds.cache.map(g => g.id);
            for (const guildId of guilds) {
                const config = getConfig(guildId);
                if (config && config.logChannelId) {
                    const channel = client.channels.cache.get(config.logChannelId);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setTitle(`⚠️ System Error: ${type}`)
                            .setURL('https://discord.com/developers/docs/topics/gateway#list-of-intents') // Dummy URL or support link
                            .setColor(0xec3d93) // Hot Pink/Red
                            .addFields(
                                { name: 'Error', value: `\`\`\`js\n${error.stack || error}\n\`\`\``, inline: false }
                            )
                            .setTimestamp();

                        await channel.send({ embeds: [embed] });
                        // Break after first successful log to avoid spamming 100 servers with the same bot internal error
                        break;
                    }
                }
            }
        } catch (err) {
            console.error('Failed to log crash to Discord:', err);
        }
    }
};
