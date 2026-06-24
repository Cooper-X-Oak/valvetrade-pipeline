import { isBuyerSide } from './entity';
import type { EntityType, Tier } from './enums';

export interface QualifyInput {
  engagementId: string;
  companyId: string;
  entityType: EntityType | null;
  tier?: Tier;
}

export interface LeadRow {
  engagement_id: string;
  company_id: string;
  state: 'qualified';
  tier: Tier;
}

/**
 * Build the engagement-scoped Lead row. A Lead materializes ONLY at qualify, and only for a
 * buyer-side company. Throws as defense-in-depth before the DB buyer-guard.
 */
export function materializeLead(input: QualifyInput): LeadRow {
  if (!isBuyerSide(input.entityType)) {
    throw new Error(
      `materializeLead: company ${input.companyId} (entity_type=${input.entityType ?? 'null'}) is not buyer-side`,
    );
  }
  return {
    engagement_id: input.engagementId,
    company_id: input.companyId,
    state: 'qualified',
    tier: input.tier ?? 'C',
  };
}
