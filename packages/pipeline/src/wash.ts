import { isBuyerSide, materializeLead, normalizeCompanyName } from '@valvetrade/domain';
import { withEngagement, type DbClient, type DbPool } from '@valvetrade/db';
import type { SourceConnector } from './connector';
import { resolveCompany } from './dedup';

export interface WashSummary {
  ingested: number;
  companies: number;
  merged: number;
  reviews: number;
  leads: number;
}

const digitsOrNull = (s?: string) => (s ? s.replace(/\D/g, '') : null);

/**
 * Run one connector through the wash pipeline (ingest -> dedup -> classify -> qualify) inside a
 * single engagement-scoped transaction. The buyer-guard, supply-flip guard and RLS are enforced
 * by the DB. The classify step here trusts the connector's entity_type_hint (skeleton behavior);
 * a richer signal-precedence classifier can replace it later.
 */
export async function washConnector(
  pool: DbPool,
  engagementId: string,
  connector: SourceConnector,
): Promise<WashSummary> {
  return withEngagement(pool, engagementId, async (client: DbClient) => {
    const summary: WashSummary = { ingested: 0, companies: 0, merged: 0, reviews: 0, leads: 0 };

    for await (const rec of connector.discover()) {
      summary.ingested++;
      const fields = rec.normalized;
      const nameNorm = normalizeCompanyName(fields.company_name_ko);
      const decision = await resolveCompany(client, fields);

      let companyId: string;
      if (decision.action === 'merge' && decision.companyId) {
        companyId = decision.companyId;
        summary.merged++;
        await client.query('UPDATE company SET last_seen_at = now() WHERE company_id = $1', [companyId]);
      } else {
        if (decision.action === 'review') summary.reviews++;
        const inserted = await client.query<{ company_id: string }>(
          `INSERT INTO company (name_ko, name_norm, biz_reg_no)
           VALUES ($1, $2, $3) RETURNING company_id`,
          [fields.company_name_ko, nameNorm, digitsOrNull(fields.biz_reg_no)],
        );
        companyId = inserted.rows[0]!.company_id;
        summary.companies++;
      }

      // Provenance (mandatory): one source_record per (source, natural_key).
      await client.query(
        `INSERT INTO source_record (source_id, natural_key, company_id, raw_payload, source_updated_at)
         SELECT s.source_id, $2, $3, $4, $5 FROM source s WHERE s.name = $1
         ON CONFLICT (source_id, natural_key)
           DO UPDATE SET company_id = EXCLUDED.company_id, fetched_at = now()`,
        [rec.source_name, rec.natural_key, companyId, JSON.stringify(rec.raw_payload), rec.source_updated_at ?? null],
      );

      // Classify (skeleton: trust the hint).
      const hint = fields.entity_type_hint ?? null;
      if (hint) {
        await client.query(
          `UPDATE company
             SET entity_type = $2, pipeline_state = 'classified',
                 classification_evidence = $3, updated_at = now()
           WHERE company_id = $1`,
          [companyId, hint, `hint:${rec.source_name}`],
        );
      }

      // Qualify: a Lead materializes ONLY for a buyer-side company (seller-types are skipped).
      if (isBuyerSide(hint)) {
        const leadRow = materializeLead({ engagementId, companyId, entityType: hint });
        const ins = await client.query<{ lead_id: string }>(
          `INSERT INTO lead (engagement_id, company_id, state, tier)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (engagement_id, company_id) DO NOTHING
           RETURNING lead_id`,
          [leadRow.engagement_id, leadRow.company_id, leadRow.state, leadRow.tier],
        );
        if (ins.rowCount && ins.rowCount > 0) {
          summary.leads++;
          await client.query(
            `UPDATE company SET pipeline_state = 'qualified' WHERE company_id = $1`,
            [companyId],
          );
        }
      }
    }

    return summary;
  });
}
