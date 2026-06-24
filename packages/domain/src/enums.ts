// Canonical enums. Stored tokens are snake_case.

export const ENTITY_TYPES = [
  'manufacturer',
  'distributor',
  'importer',
  'epc',
  'end_user',
  'public',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Demand-side types. A `manufacturer` is supply-side (a seller), never a buyer. */
export const BUYER_SIDE_TYPES = ['distributor', 'importer', 'epc', 'end_user', 'public'] as const;

export type PipelineState =
  | 'raw'
  | 'deduped'
  | 'classified'
  | 'enriched'
  | 'verified'
  | 'qualified'
  | 'rejected'
  | 'suppressed';

export type LeadState = 'qualified' | 'in_outreach' | 'engaged' | 'delivered' | 'dead';

export type Tier = 'A' | 'B' | 'C';
