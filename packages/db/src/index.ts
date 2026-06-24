import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

export type DbPool = pg.Pool;
export type DbClient = pg.PoolClient;

/** Absolute path to the ordered .sql migration files. */
export const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

export function createPool(connectionString: string): DbPool {
  return new Pool({ connectionString });
}

/**
 * Apply every pending migration in filename order, each in its own transaction,
 * tracked in `_migrations`. Idempotent: already-applied files are skipped.
 */
export async function runMigrations(pool: DbPool): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       filename text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    const done = await pool.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if (done.rowCount && done.rowCount > 0) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations(filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}

/**
 * Run `fn` inside a transaction with the tenant GUC `app.engagement_id` set transaction-locally,
 * so RLS policies on engagement-scoped tables isolate to this engagement.
 * Set value is local to the transaction; absent it, RLS fails closed (no rows).
 */
export async function withEngagement<T>(
  pool: DbPool,
  engagementId: string,
  fn: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.engagement_id', $1, true)`, [engagementId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
