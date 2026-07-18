// Generates prisma/schema.test.prisma (default) or prisma/schema.desktop.prisma
// (--variant desktop) from prisma/schema.prisma. Never edit outputs by hand.
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const variant = process.argv.includes('--variant') ? process.argv[process.argv.indexOf('--variant') + 1] : 'test';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');

const variants = {
    test: {
        file: 'schema.test.prisma',
        output: '../src/test/client',
        url: '"file:./test.db"',
    },
    desktop: {
        file: 'schema.desktop.prisma',
        output: './desktop-client',
        url: 'env("DATABASE_URL")',
    },
};
const v = variants[variant];
if (!v) throw new Error(`Unknown variant: ${variant}`);

const header = `// AUTO-GENERATED from schema.prisma by scripts/generate-test-schema.mjs — do not edit.
generator client {
  provider = "prisma-client-js"
  output   = "${v.output}"
}

datasource db {
  provider = "sqlite"
  url      = ${v.url}
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

writeFileSync(join(root, 'prisma', v.file), header + '\n' + body);
console.log(`${v.file} regenerated from schema.prisma`);
