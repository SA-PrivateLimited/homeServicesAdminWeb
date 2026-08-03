export type AddressLike = {
  address?: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
} | null | undefined;

export function formatAddress(...candidates: AddressLike[]): string {
  for (const loc of candidates) {
    if (!loc) continue;
    const parts = [
      loc.address,
      loc.landmark,
      loc.district || loc.city,
      loc.state,
      loc.pincode,
    ]
      .map((p) => (p || '').trim())
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  return '—';
}

/** Prefer explicit location.pincode; fall back to other address-like candidates. */
export function formatPincode(...candidates: AddressLike[]): string {
  for (const loc of candidates) {
    const pin = (loc?.pincode || '').trim();
    if (pin) return pin;
  }
  return '—';
}
