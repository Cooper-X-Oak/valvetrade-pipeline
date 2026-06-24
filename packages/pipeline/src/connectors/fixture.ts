import type { SourceConnector, SourceRecord } from '../connector';

/**
 * A deterministic, offline connector for the walking skeleton — no network, no keys.
 * It exercises the full wash path: a duplicate manufacturer pair (auto-merged on biz_reg_no) plus
 * three buyer-side entities (a distributor, an EPC, a public buyer) that materialize Leads.
 * All company names below are obviously-fictional samples. Replace with real connectors as needed.
 */
const RECORDS: SourceRecord[] = [
  {
    source_name: 'example_source_a',
    natural_key: 'sample-valve-mfg',
    normalized: {
      company_name_ko: '테스트밸브(주)',
      biz_reg_no: '123-45-67891', // valid checksum
      entity_type_hint: 'manufacturer',
      product_terms: ['볼밸브', '게이트밸브'],
    },
    raw_payload: { rep: '홍길동', tel: '051-000-0000' },
  },
  {
    // Duplicate of the above (same biz_reg_no, different surface form) -> rank-1 auto-merge.
    source_name: 'example_source_b',
    natural_key: 'sample-valve-mfg-alt',
    normalized: {
      company_name_ko: '테스트밸브 주식회사',
      biz_reg_no: '1234567891',
      entity_type_hint: 'manufacturer',
      website: 'http://sample-valve.example',
    },
    raw_payload: { source_updated_at: '2026-06-20' },
    source_updated_at: '2026-06-20T00:00:00Z',
  },
  {
    source_name: 'example_source_b',
    natural_key: 'acme-distribution',
    normalized: {
      company_name_ko: '에이크미유통(주)',
      entity_type_hint: 'distributor',
      phone: '031-555-2020',
    },
    raw_payload: {},
  },
  {
    source_name: 'example_source_c',
    natural_key: 'example-epc',
    normalized: {
      company_name_ko: '예시이앤씨',
      entity_type_hint: 'epc',
    },
    raw_payload: { role: 'tendering_institution' },
  },
  {
    source_name: 'example_source_c',
    natural_key: 'sample-public-buyer',
    normalized: {
      company_name_ko: '샘플시 상수도사업본부',
      entity_type_hint: 'public',
    },
    raw_payload: { role: 'tendering_institution' },
  },
];

export class FixtureConnector implements SourceConnector {
  readonly sourceName = 'fixture';

  async *discover(): AsyncIterable<SourceRecord> {
    for (const rec of RECORDS) yield rec;
  }
}

export const FIXTURE_EXPECTED = {
  records: RECORDS.length, // 5
  companies: 4, // 1 manufacturer (merged) + 3 buyer-side
  merged: 1,
  leads: 3, // distributor + epc + public
} as const;
