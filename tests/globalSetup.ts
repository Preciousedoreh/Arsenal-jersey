import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/** Applies migrations to the dedicated test database once before the suite runs. */
export default function setup(): void {
  const env = parseEnv(readFileSync('.env.test', 'utf8')) as Record<string, string>;
  const url = env.DATABASE_URL ?? '';
  if (!/_test\b/.test(url)) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL in .env.test must point at a *_test database (got ${url})`,
    );
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
