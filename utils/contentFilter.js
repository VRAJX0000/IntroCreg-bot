const BLACKLIST = [
    'badword', 'offensive', 'spam', 'scam', 'discord.gg', 'invite'
    // Add more words here or load from a file/DB
];

/**
 * Checks if the text contains any blacklisted words.
 * @param {string} text 
 * @returns {boolean} True if profanity is found
 */
function containsProfanity(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return BLACKLIST.some(word => lowerText.includes(word));
}

module.exports = { containsProfanity };
