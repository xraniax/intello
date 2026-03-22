import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../src/utils/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const migrationPath = path.join(__dirname, '../../db/migrations/04_storage_management.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('--- Running Storage Management Migration ---');
    try {
        await query(sql);
        console.log('Success: Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error: Migration failed.');
        console.error(error.message);
        process.exit(1);
    }
}

runMigration();
