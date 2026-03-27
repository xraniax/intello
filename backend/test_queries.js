import dotenv from 'dotenv';
dotenv.config();

import User from './src/models/user.model.js';
import QuotaService from './src/services/quota.service.js';

async function runTests() {
    try {
        console.log("Testing User.findAll...");
        const users = await User.findAll({ limit: 1 });
        console.log("User.findAll Success. Found:", users.length);
        
        if (users.length > 0) {
            const userId = users[0].id;
            console.log("\nTesting QuotaService.getUserStorageStats for user", userId, "...");
            const stats = await QuotaService.getUserStorageStats(userId);
            console.log("getUserStorageStats Success. Stats:", stats);
        }

        console.log("\nTesting QuotaService.getGlobalStorageStats...");
        const globalStats = await QuotaService.getGlobalStorageStats();
        console.log("getGlobalStorageStats Success. Global Stats:", globalStats);
        
        process.exit(0);
    } catch (error) {
        console.error("Test failed:", error);
        process.exit(1);
    }
}

runTests();
