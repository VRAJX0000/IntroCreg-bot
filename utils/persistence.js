const { pool, query, initDb } = require('./db');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data.json');

// --- Helper: Migrate JSON to SQL ---
async function migrateJsonToSql() {
    try {
        if (!fs.existsSync(dataPath)) return;

        console.log('🔄 Checking for data.json to migrate...');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        let data;
        try {
            data = JSON.parse(rawData);
        } catch {
            console.warn('⚠️ data.json was invalid JSON. Skipping migration.');
            return;
        }

        // data format: { guildId: { userId: { ... } } }
        let count = 0;
        for (const guildId in data) {
            const users = data[guildId];
            if (typeof users === 'object') {
                for (const userId in users) {
                    const submission = users[userId];
                    const jsonData = JSON.stringify(submission);

                    // Insert into DB
                    await query(
                        `INSERT IGNORE INTO submissions (guild_id, user_id, json_data) VALUES (?, ?, ?)`,
                        [guildId, userId, jsonData]
                    );
                    count++;
                }
            }
        }

        if (count > 0) {
            console.log(`✅ Migrated ${count} records from data.json to SQL.`);
            // Rename data.json to prevent re-migration
            fs.renameSync(dataPath, path.join(__dirname, '../data.json.bak'));
            console.log('✅ Renamed data.json to data.json.bak');
        } else {
            console.log('ℹ️ No records found in data.json to migrate.');
        }

    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
}

// Initialize on require (Async but won't block require, consumers need to await methods)
// We export an init function to be called in index.js
async function initPersistence() {
    await initDb();
    await migrateJsonToSql();
}

// --- Async Methods ---

async function hasSubmitted(guildId, userId) {
    try {
        const [rows] = await query(
            'SELECT 1 FROM submissions WHERE guild_id = ? AND user_id = ? LIMIT 1',
            [guildId, userId]
        );
        return rows.length > 0;
    } catch (err) {
        console.error('Error in hasSubmitted:', err);
        return false;
    }
}

async function getSubmission(guildId, userId) {
    try {
        const [rows] = await query(
            'SELECT json_data FROM submissions WHERE guild_id = ? AND user_id = ?',
            [guildId, userId]
        );
        if (rows.length === 0) return null;

        // rows[0].json_data is automatically parsed by mysql2 if column is JSON type, 
        // OR might be string if treating as Text. Let's handle both.
        let data = rows[0].json_data;
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        return data;
    } catch (err) {
        console.error('Error in getSubmission:', err);
        return null;
    }
}

async function addSubmission(guildId, userId, metadata = {}) {
    try {
        // We need to merge with existing data to behave like the old system,
        // OR the caller already provides the full object.
        // The old `addSubmission` loaded data, merged, and saved. 
        // Step 1: Get existing data
        const currentData = await getSubmission(guildId, userId) || {};

        // Step 2: Merge
        const newData = {
            ...currentData,
            ...metadata,
            timestamp: Date.now()
        };

        const jsonString = JSON.stringify(newData);

        // Step 3: Upsert
        await query(
            `INSERT INTO submissions (guild_id, user_id, json_data) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE json_data = VALUES(json_data), updated_at = CURRENT_TIMESTAMP`,
            [guildId, userId, jsonString]
        );
        console.log(`💾 Saved submission for ${userId}`);
    } catch (err) {
        console.error('Error in addSubmission:', err);
    }
}

async function removeSubmission(guildId, userId) {
    try {
        const [result] = await query(
            'DELETE FROM submissions WHERE guild_id = ? AND user_id = ?',
            [guildId, userId]
        );
        return result.affectedRows > 0;
    } catch (err) {
        console.error('Error in removeSubmission:', err);
        return false;
    }
}

async function getStats(guildId) {
    try {
        // Count Approved
        const [approvedRows] = await query(
            "SELECT COUNT(*) as count FROM submissions WHERE guild_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(json_data, '$.status')) = 'approved'",
            [guildId]
        );

        // Count Pending (status = 'pending')
        const [pendingRows] = await query(
            "SELECT COUNT(*) as count FROM submissions WHERE guild_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(json_data, '$.status')) = 'pending'",
            [guildId]
        );

        return {
            totalApproved: approvedRows[0]?.count || 0,
            totalPending: pendingRows[0]?.count || 0
        };
    } catch (err) {
        console.error('Error in getStats:', err);
        return { totalApproved: 0, totalPending: 0 };
    }
}

module.exports = { initPersistence, hasSubmitted, addSubmission, getSubmission, removeSubmission, getStats };
