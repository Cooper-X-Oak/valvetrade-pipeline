import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbPool } from '@valvetrade/db';
import { adminPool, resetData, seedEngagement } from './helpers/db';

let admin: DbPool;
beforeAll(() => {
  admin = adminPool();
});
afterAll(async () => {
  await admin.end();
});
beforeEach(() => resetData(admin));

async function makeCompany(name: string, entityType: string): Promise<string> {
  const r = await admin.query<{ company_id: string }>(
    'INSERT INTO company(name_ko, name_norm, entity_type) VALUES ($1, $2, $3) RETURNING company_id',
    [name, name, entityType],
  );
  return r.rows[0]!.company_id;
}

describe('guard 1: buyer != seller', () => {
  it('rejects making a manufacturer a Lead', async () => {
    const { engagementId } = await seedEngagement(admin);
    const companyId = await makeCompany('테스트밸브(주)', 'manufacturer');
    await expect(
      admin.query('INSERT INTO lead(engagement_id, company_id) VALUES ($1, $2)', [engagementId, companyId]),
    ).rejects.toThrow(/buyer_guard/);
  });

  it('allows a distributor to become a Lead', async () => {
    const { engagementId } = await seedEngagement(admin);
    const companyId = await makeCompany('에이크미유통(주)', 'distributor');
    const r = await admin.query(
      'INSERT INTO lead(engagement_id, company_id) VALUES ($1, $2) RETURNING lead_id',
      [engagementId, companyId],
    );
    expect(r.rowCount).toBe(1);
  });
});

describe('guard 2: supply-flip', () => {
  it('blocks flipping a Lead-referenced company to manufacturer', async () => {
    const { engagementId } = await seedEngagement(admin);
    const companyId = await makeCompany('에이크미유통(주)', 'distributor');
    await admin.query('INSERT INTO lead(engagement_id, company_id) VALUES ($1, $2)', [engagementId, companyId]);
    await expect(
      admin.query("UPDATE company SET entity_type = 'manufacturer' WHERE company_id = $1", [companyId]),
    ).rejects.toThrow(/supply_flip_guard/);
  });
});

describe('guard 3: report snapshot immutability', () => {
  it('freezes once, rejects snapshot changes, but allows telemetry updates', async () => {
    const { engagementId } = await seedEngagement(admin);
    const r = await admin.query<{ report_id: string }>(
      'INSERT INTO report(engagement_id) VALUES ($1) RETURNING report_id',
      [engagementId],
    );
    const reportId = r.rows[0]!.report_id;

    // freeze (snapshot was NULL -> allowed)
    await admin.query(
      'UPDATE report SET snapshot = $2, snapshot_hash = $3, frozen_at = now(), cycle_id = $4 WHERE report_id = $1',
      [reportId, JSON.stringify({ buyers: [] }), 'hash1', 'c1'],
    );

    // mutating the frozen snapshot -> rejected
    await expect(
      admin.query('UPDATE report SET snapshot = $2 WHERE report_id = $1', [
        reportId,
        JSON.stringify({ buyers: [1] }),
      ]),
    ).rejects.toThrow(/report_immutable/);

    // telemetry columns stay mutable
    const t = await admin.query(
      "UPDATE report SET view_count = view_count + 1, conversion_status = 'viewed' WHERE report_id = $1",
      [reportId],
    );
    expect(t.rowCount).toBe(1);
  });
});
