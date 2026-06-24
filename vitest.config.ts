import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@valvetrade/domain': r('./packages/domain/src/index.ts'),
      '@valvetrade/db': r('./packages/db/src/index.ts'),
      '@valvetrade/pipeline': r('./packages/pipeline/src/index.ts'),
    },
  },
  test: {
    globals: false,
    include: ['packages/*/test/**/*.test.ts'],
    globalSetup: ['packages/pipeline/test/helpers/global-setup.ts'],
    // Guard tests share one embedded Postgres instance; keep them serial and give
    // the first run room to download the PG binary on a cold machine.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
