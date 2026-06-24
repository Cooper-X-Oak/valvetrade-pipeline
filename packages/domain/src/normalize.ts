import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/** NFC + strip common Korean corporate forms + collapse whitespace, for dedup blocking. */
export function normalizeCompanyName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/주식회사|㈜|\(주\)|（주）/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Validate a Korean 사업자등록번호 (10 digits) by its official checksum.
 * Proves well-formedness only (not that the business is live).
 */
export function isValidBizRegNo(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10) return false;
  const digits = [...d].map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i]! * weights[i]!;
  sum += Math.floor((digits[8]! * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === digits[9];
}

export interface NormalizedPhone {
  e164: string | null;
  /** 0507/050x are Korean virtual relay numbers — not a direct line; deprioritized in outreach. */
  isVirtual: boolean;
}

export function normalizePhone(raw: string): NormalizedPhone {
  const digits = raw.replace(/\D/g, '');
  const isVirtual = /^050\d/.test(digits);
  const parsed = parsePhoneNumberFromString(raw, 'KR');
  return { e164: parsed?.isValid() ? parsed.number : null, isVirtual };
}
