import { createPool, runMigrations } from './index';

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_ADMIN_URL (or DATABASE_URL) to the migration role connection string.');
  process.exit(1);
}

const pool = createPool(url);
try {
  const applied = await runMigrations(pool);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Up to date.');
} finally {
  await pool.end();
}
