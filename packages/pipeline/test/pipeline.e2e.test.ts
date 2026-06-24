import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { withEngagement, type DbPool } from '@valvetrade/db';
import { FixtureConnector, FIXTURE_EXPECTED, washConnector } from '@valvetrade/pipeline';
import { adminPool, appPool, resetData, seedEngagement } from './helpers/db';

describe('fixture wash pipeline (end to end)', () => {
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

  it('washes the fixture into companies + buyer-side leads, never a manufacturer lead', async () => {
    const { engagementId } = await seedEngagement(admin);

    const summary = await washConnector(app, engagementId, new FixtureConnector());
    expect(summary.ingested).toBe(FIXTURE_EXPECTED.records);
    expect(summary.companies).toBe(FIXTURE_EXPECTED.companies);
    expect(summary.merged).toBe(FIXTURE_EXPECTED.merged);
    expect(summary.leads).toBe(FIXTURE_EXPECTED.leads);

    // the duplicate manufacturer collapsed to one, is not buyer-side, and has no lead
    const mfr = await admin.query<{ company_id: string; is_buyer_side: boolean }>(
      "SELECT company_id, is_buyer_side FROM company WHERE entity_type = 'manufacturer'",
    );
    expect(mfr.rowCount).toBe(1);
    expect(mfr.rows[0]!.is_buyer_side).toBe(false);

    const mfrLeads = await admin.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM lead WHERE company_id = $1',
      [mfr.rows[0]!.company_id],
    );
    expect(mfrLeads.rows[0]!.n).toBe(0);

    // exactly the three buyer-side leads, visible under the engagement
    const seen = await withEngagement(app, engagementId, (client) =>
      client.query<{ n: number }>('SELECT count(*)::int AS n FROM lead'),
    );
    expect(seen.rows[0]!.n).toBe(3);

    // every persisted record carries provenance
    const orphanProvenance = await admin.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM source_record WHERE company_id IS NULL',
    );
    expect(orphanProvenance.rows[0]!.n).toBe(0);
  });
});
