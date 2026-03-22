import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/user.model.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Seed a new admin user into the database.
 * Usage: node scripts/createAdmin.js [email] [password] [name]
 */
async function createAdmin() {
    const email = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@cognify.com';
    const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'Admin123!';
    const name = process.argv[4] || 'System Admin';

    console.log('--- Admin Seeding Utility ---');

    // 1. Basic Validation
    if (!email || !email.includes('@')) {
        console.error('Error: Invalid email format.');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('Error: Password must be at least 8 characters long.');
        process.exit(1);
    }

    try {
        // 2. Check for duplicate
        console.log(`Checking if admin ${email} already exists...`);
        const existing = await User.findByEmail(email);

        if (existing) {
            if (existing.role === 'admin') {
                console.log('Info: Admin user already exists. Skipping creation.');
            } else {
                console.log(`Info: User exists but is a ${existing.role}. Promoting to admin...`);
                await User.adminUpdate(existing.id, { role: 'admin' });
                console.log('Success: User promoted to Admin.');
            }
            process.exit(0);
        }

        // 3. Create Admin
        console.log(`Creating new admin: ${name} (${email})...`);
        const newUser = await User.create(email, password, name, 'admin');

        if (newUser) {
            console.log('Success: Admin user created successfully.');
            console.log('------------------------------');
            console.log(`Email: ${newUser.email}`);
            console.log(`Role: ${newUser.role}`);
            console.log('------------------------------');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error: Failed to create admin user.');
        console.error(error.message);
        process.exit(1);
    }
}

createAdmin();
