import app from './app';
import { config } from './config/env';
import { prisma } from './config/database';
import { AuthService } from './services/auth';

async function main() {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected');

    // Desktop onboarding "Test connection": probe and exit, no server.
    if (process.env.DB_CHECK_ONLY === 'true') {
        await prisma.$queryRawUnsafe('SELECT 1');
        console.log('DB_CHECK_OK');
        process.exit(0);
    }

    // Desktop modes ship migration SQL as a resource; apply before seeding.
    if (process.env.MIGRATIONS_DIR) {
        const { runMigrations } = await import('./services/migrationRunner');
        await runMigrations(process.env.MIGRATIONS_DIR);
    }

    // Seed owner account on first boot
    await AuthService.seedOwner();

    // Start server
    app.listen(parseInt(config.APP_PORT), '0.0.0.0', () => {
        console.log(`🚀 NgocKy API running on port ${config.APP_PORT} (${config.NODE_ENV})`);
    });

    // Desktop modes 2/3 run the reminder scheduler in-process (replaces n8n).
    if (process.env.SCHEDULER_ENABLED === 'true') {
        const { startScheduler } = await import('./services/scheduler');
        startScheduler();
    }
}

main().catch((err) => {
    console.error('❌ Failed to start:', err);
    process.exit(1);
});
