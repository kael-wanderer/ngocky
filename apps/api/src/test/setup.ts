import { beforeAll, beforeEach, afterAll } from 'vitest';
import { execSync } from 'child_process';

process.env.DATABASE_URL = 'file:./test.db';
let prisma: any;

beforeAll(async () => {
    // Sync the SQLite test schema directly instead of replaying the main
    // Postgres migration history.
    console.log('--- Setting up test database ---');
    execSync(
        'npx prisma db push --schema prisma/schema.test.prisma --accept-data-loss',
        { stdio: 'inherit' },
    );
    ({ prisma } = await import('../config/database'));
});

beforeEach(async () => {
    // Basic cleanup: Delete all data from tables
    const tablenames = await prisma.$queryRaw<
        Array<{ name: string }>
    >`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'prisma_%' AND name NOT LIKE '_prisma_%';`;

    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');

    for (const { name } of tablenames) {
        if (name !== 'sqlite_sequence') {
            try {
                await prisma.$executeRawUnsafe(`DELETE FROM "${name}";`);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }

    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
});

afterAll(async () => {
    await prisma.$disconnect();
});
