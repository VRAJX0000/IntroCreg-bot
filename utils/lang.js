const fs = require('fs');
const path = require('path');
const { getConfig } = require('./serverConfig');

const locales = {};
const localesPath = path.join(__dirname, '../locales');

// Load all locales on startup
function loadLocale(langCode) {
    if (locales[langCode]) return locales[langCode];

    const filePath = path.join(localesPath, `${langCode}.json`);
    if (fs.existsSync(filePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            locales[langCode] = data;
            return data;
        } catch (err) {
            console.error(`Failed to load locale ${langCode}:`, err);
        }
    }
    return null;
}

// Initial Load of everything found
if (fs.existsSync(localesPath)) {
    const files = fs.readdirSync(localesPath).filter(file => file.endsWith('.json'));
    files.forEach(file => loadLocale(file.replace('.json', '')));
}

/**
 * Translates a key for a specific guild.
 * @param {string} key - Dot notation key (e.g. 'intro.submit_success')
 * @param {string} guildId 
 * @param {Object} vars - Variables to replace {name}
 * @returns {string} Translated string
 */
function t(key, guildId, vars = {}) {
    const config = getConfig(guildId);
    const lang = config.language || 'en';

    // Fallback to EN if language not found
    let locale = locales[lang];
    if (!locale) {
        // Try dynamic load
        locale = loadLocale(lang);
    }
    // Final fallback
    locale = locale || locales['en'] || {};

    // Traverse dot notation
    const keys = key.split('.');
    let value = locale;
    for (const k of keys) {
        value = value[k];
        if (!value) break;
    }

    if (!value) {
        // Fallback to EN if key missing in target lang
        value = locales['en'];
        for (const k of keys) {
            value = value ? value[k] : null;
        }
    }

    if (!value || typeof value !== 'string') return key; // Return key if missing

    // Replace variables
    for (const [vKey, vVal] of Object.entries(vars)) {
        value = value.replace(new RegExp(`{${vKey}}`, 'g'), vVal);
    }

    return value;
}

module.exports = { t };
