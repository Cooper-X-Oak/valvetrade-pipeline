import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbPool } from '@valvetrade/db';
import { bandFor, resolveCompany } from '@valvetrade/pipeline';
import { adminPool, appPool, resetData, withClient } from './helpers/db';

describe('dedup score bands', () => {
  it('maps scores to actions', () => {
    expect(bandFor(95)).toBe('merge');
    expect(bandFor(90)).toBe('merge');
    expect(bandFor(80)).toBe('review');
    expect(bandFor(74)).toBe('new');
  });
});

describe('resolveCompany (DB-backed)', () => {
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

  it('auto-merges on exact biz_reg_no regardless of name', async () => {
    await admin.query(
      "INSERT INTO company(name_ko, name_norm, biz_reg_no, entity_type) VALUES ('테스트밸브', '테스트밸브', '1234567891', 'manufacturer')",
    );
    const dec = await withClient(app, (client) =>
      resolveCompany(client, { company_name_ko: '완전히 다른 이름', biz_reg_no: '123-45-67891' }),
    );
    expect(dec.action).toBe('merge');
    expect(dec.score).toBe(100);
  });

  it('returns new for a dissimilar name with no biz_reg_no', async () => {
    await admin.query(
      "INSERT INTO company(name_ko, name_norm, entity_type) VALUES ('에이크미유통', '에이크미유통', 'distributor')",
    );
    const dec = await withClient(app, (client) =>
      resolveCompany(client, { company_name_ko: '샘플시 상수도사업본부' }),
    );
    expect(dec.action).toBe('new');
  });
});
