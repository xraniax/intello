import fs from 'fs';
import path from 'path';
import { query } from '../utils/config/db.js';

/**
 * Storage Cleanup Utility
 * Identifies and removes orphaned files (on disk but not in DB)
 * and reports broken links (in DB but not on disk).
 */
export const performStorageCleanup = async () => {
    const stats = {
        orphansDeleted: 0,
        spaceFreedBytes: 0,
        brokenLinksFound: 0,
        totalScanned: 0
    };

    try {
        const uploadDir = path.resolve('uploads');
        if (!fs.existsSync(uploadDir)) {
            return stats;
        }

        // 1. Get all files from disk
        const filesOnDisk = fs.readdirSync(uploadDir);
        stats.totalScanned = filesOnDisk.length;

        // 2. Get all file filenames from DB
        const dbResult = await query('SELECT filename, size_bytes FROM files');
        const dbFilenames = new Set(dbResult.rows.map(r => r.filename));
        const dbFilesMap = new Map(dbResult.rows.map(r => [r.filename, r.size_bytes]));

        // 3. Identify and delete orphans (Disk but not DB)
        for (const filename of filesOnDisk) {
            if (!dbFilenames.has(filename)) {
                const filePath = path.join(uploadDir, filename);
                try {
                    const fileStats = fs.statSync(filePath);
                    if (fileStats.isFile()) {
                        stats.spaceFreedBytes += fileStats.size;
                        fs.unlinkSync(filePath);
                        stats.orphansDeleted++;
                    }
                } catch (err) {
                    console.error(`[Cleanup] Failed to delete orphan ${filename}:`, err.message);
                }
            }
        }

        // 4. Identify broken links (DB but not Disk)
        // We don't delete DB entries automatically here as it might be risky
        // but we report them.
        for (const [filename, size] of dbFilesMap.entries()) {
            const filePath = path.join(uploadDir, filename);
            if (!fs.existsSync(filePath)) {
                stats.brokenLinksFound++;
            }
        }

        return stats;
    } catch (error) {
        console.error('[Cleanup] Execution failed:', error);
        throw error;
    }
};
