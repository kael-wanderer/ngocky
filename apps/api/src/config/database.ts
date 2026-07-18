import type { PrismaClient as PrismaClientType } from '@prisma/client';

type PrismaClientWithLegacyCollections = PrismaClientType & {
    collection: any;
    collectionItem: any;
    collectionView: any;
};

type PrismaClientConstructor = new () => PrismaClientWithLegacyCollections;

const isTestDatabase = process.env.NODE_ENV === 'test' || process.env.DATABASE_URL?.startsWith('file:');
const isDesktopSqlite = process.env.DB_PROVIDER === 'sqlite' && process.env.NODE_ENV !== 'test';

export const usesSqlite = isTestDatabase || process.env.DB_PROVIDER === 'sqlite';

const { PrismaClient } = (
    // Desktop branch first: mode-2 DATABASE_URL starts with `file:`, which would
    // otherwise select the test client (its URL is hardcoded to test.db).
    isDesktopSqlite
        ? require('../../prisma/desktop-client')
        : isTestDatabase
            ? require('../test/client')
            : require('@prisma/client')
) as { PrismaClient: PrismaClientConstructor };

export const prisma: PrismaClientWithLegacyCollections = new PrismaClient();

// Case-insensitive `contains` filter. Postgres needs mode: 'insensitive';
// the SQLite client (tests, desktop builds) rejects `mode`, and SQLite's
// LIKE is already case-insensitive for ASCII.
export function iContains(value: string): { contains: string; mode?: 'insensitive' } {
    return isTestDatabase || process.env.DB_PROVIDER === 'sqlite'
        ? { contains: value }
        : { contains: value, mode: 'insensitive' };
}
