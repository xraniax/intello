import { query } from '../utils/config/db.js';

class SettingsService {
    static CACHE = {};
    static CACHE_TTL = 60000; // 1 minute
    static LAST_FETCH = 0;

    /**
     * Get settings for a specific key.
     */
    static async get(key) {
        const now = Date.now();
        if (this.CACHE[key] && (now - this.LAST_FETCH < this.CACHE_TTL)) {
            return this.CACHE[key];
        }

        const result = await query('SELECT value FROM admin_settings WHERE key = $1', [key]);
        const value = result.rows[0]?.value || null;

        if (value) {
            this.CACHE[key] = value;
            this.LAST_FETCH = now;
        }

        return value;
    }

    /**
     * Update settings for a specific key.
     */
    static async update(key, value) {
        await query(
            'INSERT INTO admin_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
            [key, value]
        );
        this.CACHE[key] = value;
        return value;
    }

    static async getStorageControls() {
        const stored = await this.get('storage_controls') || {};
        const defaultAllowedTypes = [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
        ];
        return {
            max_file_size_mb: stored.max_file_size_mb ?? 10,
            allowed_types: defaultAllowedTypes,
            default_user_quota_mb: stored.default_user_quota_mb ?? 100,
            max_cluster_size_gb: stored.max_cluster_size_gb ?? 100,
            max_cluster_size_bytes: stored.max_cluster_size_bytes ?? (100 * 1024 * 1024 * 1024),
            trash_ttl_days: stored.trash_ttl_days ?? (parseInt(process.env.TRASH_TTL_DAYS, 10) || 30),
            allow_public_registration: stored.allow_public_registration ?? true,
        };
    }
}

export default SettingsService;
