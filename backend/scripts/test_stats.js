import User from '../src/models/user.model.js';
import { query } from '../src/utils/config/db.js';

async function runTest() {
    console.log('--- User Stats Verification ---');

    // 1. Get the target user
    const email = 'rania.makhlouf4607@istic.ucar.tn';
    const user = await User.findByEmail(email);
    if (!user) {
        console.error(`User ${email} not found.`);
        return;
    }

    // 2. Trigger updateLastLogin
    console.log(`Updating last_login_at for ${email}...`);
    await User.updateLastLogin(user.id);

    // 3. Re-fetch and check
    const updatedUser = await User.findById(user.id);
    console.log('Last Login:', updatedUser.last_login_at);
    console.log('Last Active:', updatedUser.last_active_at);

    if (updatedUser.last_login_at && updatedUser.last_active_at) {
        console.log('PASSED: Timestamps updated correctly.');
    } else {
        console.error('FAILED: Timestamps did not update.');
    }

    // 4. Check Storage Usage in findAll
    console.log('Checking storage usage in findAll...');
    const allUsers = await User.findAll();
    const rania = allUsers.find(u => u.email === email);
    if (rania) {
        console.log(`Material Count: ${rania.material_count}`);
        console.log(`Storage Usage: ${rania.storage_usage_bytes} bytes`);
    } else {
        console.error('FAILED: User not found in findAll.');
    }

    process.exit(0);
}

runTest().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
