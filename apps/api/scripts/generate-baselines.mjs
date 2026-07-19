import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resources = join(root, '..', 'desktop', 'src-tauri', 'resources', 'migrations');

// Baselines are FROZEN snapshots (prisma/baseline/) - never the live schema.
// Post-baseline changes ship as committed numbered diffs (prisma/desktop-diffs/).
const targets = [
    { provider: 'postgres', schema: join(root, 'prisma', 'baseline', 'postgres.prisma') },
    { provider: 'sqlite', schema: join(root, 'prisma', 'baseline', 'sqlite.prisma') },
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
    const diffs = join(root, 'prisma', 'desktop-diffs', provider);
    if (existsSync(diffs)) {
        for (const f of readdirSync(diffs).filter((f) => f.endsWith('.sql'))) {
            cpSync(join(diffs, f), join(out, f));
        }
    }
    console.log(`baseline written: ${provider}`);
}
