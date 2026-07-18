import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { prisma } from '../config/database';
import { runMigrations } from '../services/migrationRunner';

describe('migration runner', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-'));

    beforeAll(async () => {
        await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS mig_smoke');
        await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS _app_migrations');
        writeFileSync(join(dir, '001_one.sql'), 'CREATE TABLE mig_smoke (id INTEGER PRIMARY KEY);\n');
        writeFileSync(join(dir, '002_two.sql'), 'INSERT INTO mig_smoke (id) VALUES (1);\n');
    });

    it('applies pending migrations in order, exactly once', async () => {
        await runMigrations(dir);
        await runMigrations(dir); // second run must be a no-op (002 would violate PK if reapplied)
        const rows = await prisma.$queryRawUnsafe<{ id: number }[]>('SELECT id FROM mig_smoke');
        expect(rows.length).toBe(1);
        const applied = await prisma.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM _app_migrations ORDER BY name');
        expect(applied.map((r) => r.name)).toEqual(['001_one.sql', '002_two.sql']);
    });

    it('rejects unsafe filenames', async () => {
        writeFileSync(join(dir, "003_bad'name.sql"), 'SELECT 1;\n');
        await expect(runMigrations(dir)).rejects.toThrow(/unsafe migration filename/i);
    });
});
