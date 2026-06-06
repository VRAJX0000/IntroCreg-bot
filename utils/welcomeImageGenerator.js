const { GlobalFonts, createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// Register a default font if needed, though system fonts usually work.
// usage: GlobalFonts.registerFromPath('path/to/font.ttf', 'MyFont');

/**
 * Generates a welcome card image.
 * @param {import('discord.js').GuildMember} member
 */
async function generateWelcomeImage(member) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    const assetsPath = path.join(__dirname, '../assets');

    const bgDir = path.join(assetsPath, 'welcome_backgrounds');

    // 1. Determine Background Path
    let selectedBgPath = path.join(assetsPath, 'welcome_bg.png'); // Default fallback

    try {
        if (fs.existsSync(bgDir)) {
            const files = await fs.promises.readdir(bgDir);
            const pngFiles = files.filter(f => f.endsWith('.png'));

            if (pngFiles.length > 0) {
                const randomFile = pngFiles[Math.floor(Math.random() * pngFiles.length)];
                selectedBgPath = path.join(bgDir, randomFile);
            }
        }
    } catch (err) {
        console.error('Error selecting random background:', err);
    }

    // 2. Draw Background
    try {
        const background = await loadImage(selectedBgPath);
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (e) {
        console.error('Failed to load background:', e);
        // Fallback: Black background if file missing
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Add "Glass" Panel (Optional, matches reference style)
    // Reference has a dark rounded rect in the center
    const cardWidth = 600;
    const cardHeight = 320;
    const cardX = (canvas.width - cardWidth) / 2;
    const cardY = (canvas.height - cardHeight) / 2;
    const cornerRadius = 30;

    ctx.fillStyle = 'rgba(20, 20, 20, 0.85)'; // Semi-transparent dark
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cornerRadius);
    ctx.fill();

    // 3. User Avatar (Circle)
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    try {
        const avatar = await loadImage(avatarUrl);
        const avatarSize = 140;
        const avatarX = (canvas.width - avatarSize) / 2;
        const avatarY = cardY + 50; // Position inside the card

        // Save context for clipping
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        // Optional circular border
        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.stroke();

    } catch (e) {
        console.error('Failed to load avatar:', e);
    }

    // 4. Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';

    // "Member #1234" Badge
    ctx.font = 'bold 20px sans-serif'; // Or "Arial"
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText(`Member #${member.guild.memberCount}`, canvas.width / 2, cardY + 35);


    // "Welcome"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('Welcome', canvas.width / 2, cardY + 230);

    // "USERNAME" (Big)
    let fontSize = 50;
    ctx.font = `bold ${fontSize}px sans-serif`;
    let name = member.user.username.toUpperCase();

    // Auto-scale text if too long
    while (ctx.measureText(name).width > cardWidth - 40 && fontSize > 20) {
        fontSize -= 5;
        ctx.font = `bold ${fontSize}px sans-serif`;
    }

    ctx.fillText(name, canvas.width / 2, cardY + 280);

    // "to GuildName"
    ctx.font = 'italic 25px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(`to ${member.guild.name}`, canvas.width / 2, cardY + 310);

    return canvas.toBuffer('image/png');
}

module.exports = { generateWelcomeImage };
