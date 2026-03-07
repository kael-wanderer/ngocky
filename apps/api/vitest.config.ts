import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/test/setup.ts'],
        fileParallelism: false,
        //threads: false, // SQLite doesn't handle multiple connections well in dev
    },
});
