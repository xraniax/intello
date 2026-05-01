import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/tests/setup.js',
        include: ['src/tests/**/*.test.{js,jsx}'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{js,jsx}'],
            exclude: [
                'src/main.jsx',
                'src/tests/**',
                'src/**/__mocks__/**',
                'src/utils/motion.js',
            ],
            thresholds: {
                statements: 65,
                branches: 60,
                functions: 65,
                lines: 65,
            },
            reporter: ['text', 'lcov', 'html'],
            reportsDirectory: './coverage',
        },
    },
});
