// Squashed schema DDL per provider, shipped as the runtime baseline migration.
// Future schema changes: add NNN_name.sql diff files next to the baseline
// (generate with `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new> --script`).
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resources = join(root, '..', 'desktop', 'src-tauri', 'resources', 'migrations');

const targets = [
    { provider: 'postgres', schema: join(root, 'prisma', 'schema.prisma') },
    { provider: 'sqlite', schema: join(root, 'prisma', 'schema.desktop.prisma') }, // exists from Phase 3 onward
];

for (const { provider, schema } of targets) {
    if (!existsSync(schema)) {
        console.log(`skip ${provider}: ${schema} missing`);
        continue;
    }
    const out = join(resources, provider);
    mkdirSync(out, { recursive: true });
    execSync(
        `npx prisma migrate diff --from-empty --to-schema-datamodel "${schema}" --script > "${join(out, '000_baseline.sql')}"`,
        { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], shell: '/bin/bash' }
    );
    console.log(`baseline written: ${provider}`);
}
