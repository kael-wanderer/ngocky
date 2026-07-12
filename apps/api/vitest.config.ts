import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        globals: true,
        environment: 'node',
        setupFiles: ['./src/test/setup.ts'],
        pool: 'threads',
        maxWorkers: 1,
        minWorkers: 1,
        fileParallelism: false,
    },
});
