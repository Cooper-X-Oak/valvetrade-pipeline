import EmbeddedPostgres from 'embedded-postgres';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { createPool, runMigrations } from '@valvetrade/db';
import { PORT } from './db';

/**
 * One embedded Postgres for the whole test run (no Docker required). Real Postgres, so triggers,
 * RLS and pg_trgm behave exactly as in production. Started once here; test files connect over TCP.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const dataDir = join(process.cwd(), '.pgdata', 'test');
  rmSync(dataDir, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('valvetrade');

  const admin = createPool(`postgres://postgres:postgres@127.0.0.1:${PORT}/valvetrade`);
  try {
    await runMigrations(admin);
  } finally {
    await admin.end();
  }

  return async () => {
    await pg.stop();
  };
}
