const fs = require('node:fs');
const path = require('node:path');

const configPath = path.join(__dirname, '../serverConfig.json');

function getConfig(guildId) {
    if (!guildId) return {}; // Safety check
    try {
        if (!fs.existsSync(configPath)) {
            return {};
        }
        const data = fs.readFileSync(configPath, 'utf8');
        const allConfigs = JSON.parse(data);
        return allConfigs[guildId] || {};
    } catch (err) {
        console.error('Error reading config:', err);
        return {};
    }
}

function setConfig(guildId, key, value) {
    if (!guildId) return;
    try {
        let allConfigs = {};
        if (fs.existsSync(configPath)) {
            allConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }

        if (!allConfigs[guildId]) allConfigs[guildId] = {};
        allConfigs[guildId][key] = value;

        fs.writeFileSync(configPath, JSON.stringify(allConfigs, null, 2));
    } catch (err) {
        console.error('Error writing config:', err);
    }
}

function saveConfig(guildId, newConfig) {
    if (!guildId) return;
    try {
        let allConfigs = {};
        if (fs.existsSync(configPath)) {
            allConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }

        allConfigs[guildId] = newConfig;

        fs.writeFileSync(configPath, JSON.stringify(allConfigs, null, 2));
    } catch (err) {
        console.error('Error saving config:', err);
    }
}

module.exports = { getConfig, setConfig, saveConfig };
