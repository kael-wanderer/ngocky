// Generates prisma/schema.test.prisma from prisma/schema.prisma.
// Run automatically by the test setup — never edit schema.test.prisma by hand.
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');

const header = `// AUTO-GENERATED from schema.prisma by scripts/generate-test-schema.mjs — do not edit.
generator client {
  provider = "prisma-client-js"
  output   = "../src/test/client"
}

datasource db {
  provider = "sqlite"
  url      = "file:./test.db"
}
`;

const body = source
    .replace(/generator client \{[^}]*\}\s*/m, '')
    .replace(/datasource db \{[^}]*\}\s*/m, '')
    // SQLite has no scalar lists — store them as Json (arrays round-trip fine)
    .replace(/\b(String|Int|Float|Boolean|DateTime)\[\]/g, 'Json?')
    // Prisma's SQLite DDL renderer does not quote JSON object/array defaults.
    // Keep these nullable in tests; application normalization supplies defaults.
    .replace(/\bJson\s+@default\([^\n]+\)/g, 'Json?');

writeFileSync(join(root, 'prisma', 'schema.test.prisma'), header + '\n' + body);
console.log('schema.test.prisma regenerated from schema.prisma');
