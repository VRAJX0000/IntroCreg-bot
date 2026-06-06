/**
 * Simple in-memory rate limiter
 */
class RateLimitManager {
    constructor() {
        // Map<key, timestamp>
        this.limits = new Map();
    }

    /**
     * Check if a user is rate limited.
     * @param {string} userId - Discord User ID
     * @param {string} actionKey - Unique key for action (e.g., 'cmd_vote', 'btn_click')
     * @param {number} cooldownSeconds - Cooldown duration in seconds
     * @returns {number} - 0 if allowed, otherwise remaining milliseconds
     */
    check(userId, actionKey, cooldownSeconds) {
        const key = `${userId}:${actionKey}`;
        const now = Date.now();
        const cooldownMs = cooldownSeconds * 1000;

        if (this.limits.has(key)) {
            const expirationTime = this.limits.get(key) + cooldownMs;
            if (now < expirationTime) {
                return expirationTime - now;
            }
        }

        // Not limited, set new timestamp
        this.limits.set(key, now);

        // Cleanup memory occasionally (simple way: don't worry for small scale, 
        // or use setTimeout to delete key)
        setTimeout(() => this.limits.delete(key), cooldownMs);

        return 0;
    }
}

module.exports = new RateLimitManager();
