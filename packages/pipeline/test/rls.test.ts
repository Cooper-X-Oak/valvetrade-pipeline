import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { withEngagement, type DbPool } from '@valvetrade/db';
import { adminPool, appPool, resetData, seedEngagement } from './helpers/db';

let admin: DbPool;
let app: DbPool;
beforeAll(() => {
  admin = adminPool();
  app = appPool();
});
afterAll(async () => {
  await app.end();
  await admin.end();
});
beforeEach(() => resetData(admin));

describe('RLS engagement isolation (lead)', () => {
  it('isolates leads per engagement and fails closed when unset', async () => {
    const a = await seedEngagement(admin, 'A');
    const b = await seedEngagement(admin, 'B');
    const c = await admin.query<{ company_id: string }>(
      "INSERT INTO company(name_ko, name_norm, entity_type) VALUES ('x', 'x', 'distributor') RETURNING company_id",
    );
    const companyId = c.rows[0]!.company_id;

    // insert under engagement A as the non-owner app role
    await withEngagement(app, a.engagementId, (client) =>
      client.query('INSERT INTO lead(engagement_id, company_id) VALUES ($1, $2)', [a.engagementId, companyId]),
    );

    const seenA = await withEngagement(app, a.engagementId, (client) =>
      client.query<{ n: number }>('SELECT count(*)::int AS n FROM lead'),
    );
    expect(seenA.rows[0]!.n).toBe(1);

    const seenB = await withEngagement(app, b.engagementId, (client) =>
      client.query<{ n: number }>('SELECT count(*)::int AS n FROM lead'),
    );
    expect(seenB.rows[0]!.n).toBe(0);

    // no engagement context set -> RLS fails closed
    const raw = await app.query<{ n: number }>('SELECT count(*)::int AS n FROM lead');
    expect(raw.rows[0]!.n).toBe(0);
  });

  it("rejects writing a lead into another engagement's scope (WITH CHECK)", async () => {
    const a = await seedEngagement(admin, 'A');
    const b = await seedEngagement(admin, 'B');
    const c = await admin.query<{ company_id: string }>(
      "INSERT INTO company(name_ko, name_norm, entity_type) VALUES ('y', 'y', 'epc') RETURNING company_id",
    );
    const companyId = c.rows[0]!.company_id;

    await expect(
      withEngagement(app, a.engagementId, (client) =>
        client.query('INSERT INTO lead(engagement_id, company_id) VALUES ($1, $2)', [b.engagementId, companyId]),
      ),
    ).rejects.toThrow();
  });
});
