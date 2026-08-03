/**
 * Canonical phone display / input helpers (India-first, +91).
 * Prefer displaying E.164-style: +91 98765 43210
 */

export function digitsOnly(value?: string | null): string {
  return (value || '').replace(/\D/g, '');
}

export function localTenDigits(value?: string | null): string {
  const digits = digitsOnly(value);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function toE164(value?: string | null, defaultCc = '+91'): string {
  let cleaned = (value || '').trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
  if (!cleaned.startsWith('+')) {
    const ten = localTenDigits(cleaned);
    if (ten.length === 10) return `${defaultCc}${ten}`;
    return `+${digitsOnly(cleaned)}`;
  }
  return cleaned;
}

/** Prefer phone / phoneNumber / any raw string → display form. */
export function formatPhoneDisplay(
  ...candidates: Array<string | null | undefined>
): string {
  const raw = candidates.find((c) => (c || '').trim()) || '';
  if (!raw) return '—';
  const e164 = toE164(raw);
  const ten = localTenDigits(e164);
  if (ten.length !== 10) return e164 || raw;
  const cc = e164.startsWith('+') ? e164.slice(0, e164.length - 10) : '+91';
  return `${cc} ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

export function phoneSearchValue(
  ...candidates: Array<string | null | undefined>
): string {
  const raw = candidates.find((c) => (c || '').trim()) || '';
  return `${raw} ${digitsOnly(raw)} ${formatPhoneDisplay(raw)}`;
}
