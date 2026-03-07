import { beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '../config/database';
import { execSync } from 'child_process';

// We override the DATABASE_URL to use an in-memory or file-based SQLite for tests
// NOTE: In a real monorepo setup, you'd often use a .env.test file
process.env.DATABASE_URL = 'file:./test.db';

beforeAll(async () => {
    // Run migrations on the test database using the test schema
    console.log('--- Setting up test database ---');
    execSync('npx prisma migrate dev --name init --schema prisma/schema.test.prisma --skip-generate', { stdio: 'inherit' });
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
