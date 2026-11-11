import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

const testEnv = parseEnv(readFileSync('.env.test', 'utf8')) as Record<string, string>;

export default defineConfig({
  test: {
    environment: 'node',
    env: testEnv,
    globalSetup: ['./tests/globalSetup.ts'],
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // All suites share one Postgres test database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
