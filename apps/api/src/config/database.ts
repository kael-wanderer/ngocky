const { PrismaClient } =
    process.env.NODE_ENV === 'test'
        ? require('../test/client')
        : require('@prisma/client');

export const prisma = new PrismaClient();

// Case-insensitive `contains` filter. Postgres needs mode: 'insensitive';
// the SQLite client (tests, desktop builds) rejects `mode`, and SQLite's
// LIKE is already case-insensitive for ASCII.
export function iContains(value: string): { contains: string; mode?: 'insensitive' } {
    return process.env.NODE_ENV === 'test' || process.env.DB_PROVIDER === 'sqlite'
        ? { contains: value }
        : { contains: value, mode: 'insensitive' };
}
