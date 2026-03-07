import app from './app';
import { config } from './config/env';
import { prisma } from './config/database';
import { AuthService } from './services/auth';

async function main() {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected');

    // Seed owner account on first boot
    await AuthService.seedOwner();

    // Start server
    app.listen(parseInt(config.APP_PORT), '0.0.0.0', () => {
        console.log(`🚀 NgocKy API running on port ${config.APP_PORT} (${config.NODE_ENV})`);
    });
}

main().catch((err) => {
    console.error('❌ Failed to start:', err);
    process.exit(1);
});
