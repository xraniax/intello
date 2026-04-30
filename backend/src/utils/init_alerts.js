import { query } from './config/db.js';

const initAlerts = async () => {
    console.log('--- Initializing System Alerts Table ---');
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS system_alerts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type VARCHAR(50) NOT NULL,
                severity VARCHAR(20) NOT NULL DEFAULT 'ERROR',
                title VARCHAR(255) NOT NULL,
                message TEXT,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                entity_id UUID,
                is_resolved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(type);
            CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(is_resolved);
            CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at);
        `);
        console.log('✅ system_alerts table initialized successfully.');
    } catch (error) {
        console.error('❌ Failed to initialize system_alerts table:', error.message);
        process.exit(1);
    }
};

if (import.meta.url === `file://${process.argv[1]}`) {
    initAlerts().then(() => process.exit(0));
}

export default initAlerts;
