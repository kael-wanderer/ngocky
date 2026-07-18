// Bundles the API into a single CJS file for Node SEA packaging.
import { build } from 'esbuild';

await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: 'dist-sidecar/sidecar.cjs',
    external: ['*.node'],
    // SEA's embedded require only resolves builtins; restore full require for
    // anything resolved at runtime (Prisma engine load).
    banner: { js: "const { createRequire } = require('node:module'); require = createRequire(process.execPath);" },
    logLevel: 'info',
});
