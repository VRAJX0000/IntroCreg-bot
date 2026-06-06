const { getSubmission, removeSubmission } = require('./persistence');

/**
 * Deletes a user's submission from the database and the public channel.
 * @param {import('discord.js').Client} client 
 * @param {string} guildId 
 * @param {string} userId 
 */
async function deleteSubmission(client, guildId, userId) {
    try {
        // 1. Check for existing submission
        const submission = await getSubmission(guildId, userId);
        if (submission) {
            console.log(`Found submission for user ${userId} in guild ${guildId}. Cleaning up...`);

            // 2. Delete Public Message if it exists
            if (submission.messageId && submission.channelId) {
                try {
                    // Fetch channel (cache or API)
                    let channel = client.channels.cache.get(submission.channelId);
                    if (!channel) {
                        try {
                            channel = await client.channels.fetch(submission.channelId);
                        } catch (err) {
                            console.warn(`Could not fetch channel ${submission.channelId}: ${err.message}`);
                        }
                    }

                    if (channel) {
                        // Fetch message (delete strict or just try delete)
                        try {
                            const message = await channel.messages.fetch(submission.messageId);
                            if (message) {
                                await message.delete();
                                console.log(`🗑️ Deleted introduction message for user ${userId}`);
                            }
                        } catch (msgErr) {
                            if (msgErr.code === 10008) {
                                console.log(`Message ${submission.messageId} already deleted.`);
                            } else {
                                console.warn(`Could not delete message ${submission.messageId}:`, msgErr.message);
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`Error during message deletion process:`, err.message);
                }
            }

            // 3. Remove from Database
            await removeSubmission(guildId, userId);
            console.log(`🗑️ Removed submission from DB for user ${userId}`);
        }
    } catch (err) {
        console.error('Error in deleteSubmission:', err);
    }
}

module.exports = { deleteSubmission };
