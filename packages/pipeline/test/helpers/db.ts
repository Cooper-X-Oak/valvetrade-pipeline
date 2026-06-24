import { createPool, type DbClient, type DbPool } from '@valvetrade/db';

export const PORT = 54329;
export const ADMIN_URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/valvetrade`;
export const APP_URL = `postgres://vt_app:vt_app@127.0.0.1:${PORT}/valvetrade`;

export const adminPool = (): DbPool => createPool(ADMIN_URL);
export const appPool = (): DbPool => createPool(APP_URL);

export async function resetData(pool: DbPool): Promise<void> {
  await pool.query(
    'TRUNCATE lead, report, source_record, company, engagement, customer RESTART IDENTITY CASCADE',
  );
}

export async function seedEngagement(
  pool: DbPool,
  label = 'eng',
): Promise<{ customerId: string; engagementId: string }> {
  const c = await pool.query<{ customer_id: string }>(
    'INSERT INTO customer(handle) VALUES ($1) RETURNING customer_id',
    [`cust-${label}`],
  );
  const customerId = c.rows[0]!.customer_id;
  const e = await pool.query<{ engagement_id: string }>(
    'INSERT INTO engagement(customer_id, label) VALUES ($1, $2) RETURNING engagement_id',
    [customerId, label],
  );
  return { customerId, engagementId: e.rows[0]!.engagement_id };
}

export async function withClient<T>(pool: DbPool, fn: (c: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
