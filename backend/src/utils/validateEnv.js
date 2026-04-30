const validateEnv = () => {
    if (!process.env.JWT_SECRET) {
        if ((process.env.NODE_ENV || 'development') !== 'production') {
            process.env.JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';
            console.warn('⚠️  JWT_SECRET not set — using insecure dev fallback.');
        }
    }

    const required = ['DATABASE_URL', 'JWT_SECRET', 'ENGINE_URL'];
    const missing = required.filter(k => !process.env[k]);

    if (missing.length > 0) {
        console.error('❌ CRITICAL: Missing required environment variables:');
        missing.forEach(k => console.error(`   - ${k}`));
        console.error('💡 Local: set them in backend/.env');
        console.error('   Staging: use docker-compose.staging.yml with --env-file .env.staging');
        process.exit(1);
    }

    const optional = [
        'FRONTEND_URL', 'BACKEND_URL', 'SESSION_SECRET',
        'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
        'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET',
        'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM',
    ];
    const missingOptional = optional.filter(k => !process.env[k]);
    if (missingOptional.length > 0) {
        console.warn('⚠️  Optional integrations disabled (env vars not set):');
        missingOptional.forEach(k => console.warn(`   - ${k}`));
    }

    const dbDisplay = process.env.DATABASE_URL
        .replace(/:\/\/[^@]+@/, '://***@')
        .substring(0, 60);

    console.log('✅ Environment validated');
    console.log(`[config] node_env=${process.env.NODE_ENV || 'development'}`);
    console.log(`[config] db=${dbDisplay}`);
    console.log(`[config] engine=${process.env.ENGINE_URL}`);
};

export default validateEnv;
