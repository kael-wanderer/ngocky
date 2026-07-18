import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { prisma, usesSqlite } from '../config/database';

const LOCK_KEY = 724533177; // arbitrary app-wide advisory lock id

export async function runMigrations(dir: string) {
    await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)'
    );
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
        if (!/^[A-Za-z0-9._-]+$/.test(file)) throw new Error(`Unsafe migration filename: ${file}`);
    }
    await prisma.$transaction(
        async (tx) => {
            // xact-scoped lock: same connection guaranteed, auto-released on commit.
            // executeRaw (not queryRaw): pg_advisory_xact_lock returns void, which
            // queryRaw fails to deserialize.
            if (!usesSqlite) await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);
            const appliedRows = await tx.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM _app_migrations');
            const applied = new Set(appliedRows.map((r) => r.name));
            for (const file of files) {
                if (applied.has(file)) continue;
                const sql = readFileSync(join(dir, file), 'utf8');
                // ponytail: naive statement split — fine for Prisma-generated DDL, breaks on
                // CREATE FUNCTION bodies; switch to a real parser if we ever ship one.
                const statements = sql
                    .split(/;\s*(?:\r?\n|$)/)
                    .map((s) => s.replace(/^\s*--[^\n]*$/gm, '').trim())
                    .filter(Boolean);
                for (const stmt of statements) await tx.$executeRawUnsafe(stmt);
                await tx.$executeRawUnsafe(`INSERT INTO _app_migrations (name) VALUES ('${file}')`);
                console.log(`✅ migration applied: ${file}`);
            }
        },
        { timeout: 120_000 }
    );
}
