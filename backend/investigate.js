import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/utils/config/db.js';

async function investigate() {
    try {
        console.log("=== STORAGE INVESTIGATION ===");
        
        // 1. Files size sum
        const filesResult = await query("SELECT SUM(size_bytes) as total FROM files");
        console.log("Total bytes in files table:", filesResult.rows[0].total);

        // 2. Materials content length sum
        const materialsResult = await query("SELECT SUM(OCTET_LENGTH(COALESCE(content, ''))) as total FROM materials");
        console.log("Total bytes in materials.content:", materialsResult.rows[0].total);

        // 3. Files joined with non-failed materials
        const activeFiles = await query(`
            SELECT SUM(f.size_bytes) as total 
            FROM files f 
            LEFT JOIN materials m ON f.material_id = m.id 
            WHERE m.status IS NULL OR UPPER(m.status) != 'FAILED'
        `);
        console.log("Active files bytes:", activeFiles.rows[0].total);
        
        // 4. Non-failed materials content
        const activeMaterials = await query(`
            SELECT SUM(OCTET_LENGTH(COALESCE(content, ''))) as total 
            FROM materials 
            WHERE UPPER(status) != 'FAILED'
        `);
        console.log("Active materials content bytes:", activeMaterials.rows[0].total);

        // 5. Total from User.findAll logic
        const userSums = await query(`
             SELECT u.id,
             ((SELECT COALESCE(SUM(f.size_bytes), 0)::bigint FROM files f
               LEFT JOIN materials m ON f.material_id = m.id
               WHERE f.user_id = u.id AND (m.id IS NULL OR UPPER(m.status) != 'FAILED')) + 
              (SELECT COALESCE(SUM(OCTET_LENGTH(COALESCE(m.content, ''))), 0)::bigint FROM materials m
               WHERE m.user_id = u.id AND UPPER(m.status) != 'FAILED')
             ) as storage_usage_bytes
             FROM users u
        `);
        
        let totalUsersStorage = 0;
        console.log("\nUser Breakdown:");
        userSums.rows.forEach(r => {
            console.log(`User ${r.id}: ${r.storage_usage_bytes} bytes`);
            totalUsersStorage += parseInt(r.storage_usage_bytes) || 0;
        });
        console.log("Sum of all users:", totalUsersStorage);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

investigate();
