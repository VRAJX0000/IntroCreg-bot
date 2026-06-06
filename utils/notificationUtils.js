const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// function sendPremiumNotification removed as Premium is now free.

function getLogoAttachment() {
    const logoPath = path.join(__dirname, '..', 'logo.jpg');
    // console.log(`[Utils] Checking for logo at: ${logoPath}`); // Debug log (can be removed later)

    if (fs.existsSync(logoPath)) {
        const attachment = new AttachmentBuilder(logoPath, { name: 'logo.jpg' });
        return {
            attachment: attachment,
            url: 'attachment://logo.jpg'
        };
    } else {
        return {
            attachment: null,
            url: null // Caller should fallback to client.user.displayAvatarURL() if needed
        };
    }
}

module.exports = { getLogoAttachment };
