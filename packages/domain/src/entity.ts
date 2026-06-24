import type { EntityType } from './enums';

/**
 * buyer != seller — the governing data principle. A seller-type company (manufacturer) cannot
 * be treated as a buyer/lead. Unclassified (null) is not buyer-side yet. Mirrors the DB generated
 * column `company.is_buyer_side` so application and database agree.
 */
export function isBuyerSide(entityType: EntityType | null | undefined): boolean {
  return entityType != null && entityType !== 'manufacturer';
}
