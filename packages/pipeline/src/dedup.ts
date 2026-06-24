import { token_set_ratio } from 'fuzzball';
import { normalizeCompanyName } from '@valvetrade/domain';
import type { DbClient } from '@valvetrade/db';
import type { NormalizedFields } from './connector';

export type DedupAction = 'merge' | 'review' | 'new';

export interface DedupDecision {
  action: DedupAction;
  companyId?: string;
  score: number;
}

/** Score bands (fuzzball token_set_ratio 0–100). */
export const BAND_AUTO_MERGE = 90;
export const BAND_REVIEW = 75;

export function bandFor(score: number): DedupAction {
  if (score >= BAND_AUTO_MERGE) return 'merge';
  if (score >= BAND_REVIEW) return 'review';
  return 'new';
}

const digitsOnly = (s: string) => s.replace(/\D/g, '');

/**
 * Resolve a candidate to an existing company or a new one.
 * Key precedence: (1) biz_reg_no exact -> auto-merge; (2) pg_trgm-blocked fuzzy name ->
 * fuzzball token_set_ratio bands. Reversible-merge accounting lives upstream.
 */
export async function resolveCompany(
  client: DbClient,
  fields: NormalizedFields,
): Promise<DedupDecision> {
  if (fields.biz_reg_no) {
    const biz = digitsOnly(fields.biz_reg_no);
    const exact = await client.query<{ company_id: string }>(
      'SELECT company_id FROM company WHERE biz_reg_no = $1',
      [biz],
    );
    if (exact.rowCount && exact.rowCount > 0) {
      return { action: 'merge', companyId: exact.rows[0]!.company_id, score: 100 };
    }
  }

  const nameNorm = normalizeCompanyName(fields.company_name_ko);
  const candidates = await client.query<{ company_id: string; name_norm: string }>(
    'SELECT company_id, name_norm FROM company WHERE name_norm % $1 LIMIT 25',
    [nameNorm],
  );

  let best: { id: string; score: number } = { id: '', score: 0 };
  for (const row of candidates.rows) {
    const score = token_set_ratio(nameNorm, row.name_norm);
    if (score > best.score) best = { id: row.company_id, score };
  }

  const action = bandFor(best.score);
  return action === 'new'
    ? { action, score: best.score }
    : { action, companyId: best.id, score: best.score };
}
