import './src/utils/config/db.js';
import dotenv from 'dotenv';
dotenv.config();
import MaterialService from './src/services/material.service.js';
import { query } from './src/utils/config/db.js';

async function sync() {
    console.log("Syncing Stress Test Job Statuses...");
    const dbRes = await query("SELECT id, user_id FROM materials WHERE title LIKE 'Concurrent Job %' AND status = 'processing';");
    for (const row of dbRes.rows) {
        console.log(`Syncing material ${row.id}...`);
        await MaterialService.checkJobStatus(row.user_id, row.id);
    }
    const final = await query("SELECT title, status, length(ai_generated_content::text) as size FROM materials WHERE title LIKE 'Concurrent Job %' ORDER BY created_at DESC;");
    console.log(JSON.stringify(final.rows, null, 2));
    process.exit(0);
}
sync();
