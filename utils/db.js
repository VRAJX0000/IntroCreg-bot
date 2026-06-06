const mysql = require('mysql2/promise');
const config = require('../config');

// Create a connection pool
const pool = mysql.createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    port: config.db.port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Helper function to handle connection retries
async function query(sql, params) {
    let retries = 3;
    while (retries > 0) {
        try {
            return await pool.query(sql, params);
        } catch (err) {
            if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT') {
                retries--;
                console.warn(`⚠️ Database connection lost (${err.code}). Retrying... (${3 - retries}/3)`);
                if (retries === 0) throw err;
                await new Promise(res => setTimeout(res, 1000)); // Wait 1s before retry
            } else {
                throw err;
            }
        }
    }
}

// Initialize Database Function
async function initDb() {
    try {
        // Create submissions table if it doesn't exist
        // Note: Using JSON column for data to be flexible, or TEXT if JSON not supported by older MySQL
        await query(`
            CREATE TABLE IF NOT EXISTS submissions (
                guild_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                json_data JSON, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id)
            );
        `);
        console.log('✅ Database initialized: submissions table checked/created.');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        // Don't crash here, might be just connection text, let main process handle it
    }
}

// Export the pool (for advanced usage if needed) and the wrapped query function
module.exports = { pool, query, initDb };
