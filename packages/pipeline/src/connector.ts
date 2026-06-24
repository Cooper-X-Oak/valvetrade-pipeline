import type { EntityType } from '@valvetrade/domain';

/** Canonical normalized fields a connector emits. Korean text preserved verbatim. */
export interface NormalizedFields {
  company_name_ko: string;
  biz_reg_no?: string;
  phone?: string;
  website?: string;
  product_terms?: string[];
  /** A SIGNAL only — the classify stage decides the final entity_type. */
  entity_type_hint?: EntityType;
}

/** One observation from one source, with mandatory provenance. */
export interface SourceRecord {
  source_name: string;
  natural_key: string;
  normalized: NormalizedFields;
  source_updated_at?: string;
  raw_payload: unknown;
}

/**
 * The uniform Source Connector contract. A connector is a pure producer of
 * SourceRecords; it never resolves identity, classifies, or decides buyer-vs-seller — those are
 * shared downstream stages so the rules live in exactly one place.
 */
export interface SourceConnector {
  readonly sourceName: string;
  discover(): AsyncIterable<SourceRecord>;
}
