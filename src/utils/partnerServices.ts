import type {Provider} from '../services/api/providersApi';

export type PartnerServiceSummary = {
  name: string;
  verificationStatus?: string;
  active?: boolean;
  experience?: number;
  notes?: string;
};

function addName(seen: Set<string>, out: string[], raw?: string) {
  const name = String(raw || '').trim();
  const key = name.toLowerCase();
  if (!name || seen.has(key)) return;
  seen.add(key);
  out.push(name);
}

export function partnerServiceNames(p: Provider | null | undefined): string[] {
  if (!p) return [];
  if (p.services?.length) {
    return p.services.map((s) => s.name).filter(Boolean) as string[];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  addName(seen, out, p.serviceType);
  addName(seen, out, p.specialization);
  (p.serviceCategories || []).forEach((name) => addName(seen, out, name));
  (p.serviceQualifications || []).forEach((q) => addName(seen, out, q.name));
  return out;
}

export function partnerServiceSummaries(
  p: Provider | null | undefined,
): PartnerServiceSummary[] {
  if (!p) return [];
  if (p.services?.length) return p.services;
  const inactive = new Set(
    (p.inactiveServiceCategories || []).map((s) => s.toLowerCase()),
  );
  return partnerServiceNames(p).map((name) => {
    const q = (p.serviceQualifications || []).find(
      (item) => String(item.name || '').toLowerCase() === name.toLowerCase(),
    );
    const raw = String(q?.verificationStatus || '').toLowerCase();
    let verificationStatus = raw;
    if (raw === 'pending' && !q?.submittedAt) verificationStatus = 'required';
    if (!raw) {
      const account = String(p.approvalStatus || '').toLowerCase();
      verificationStatus =
        account === 'rejected'
          ? 'rejected'
          : account === 'pending'
            ? 'pending'
            : 'approved';
    }
    return {
      name,
      verificationStatus,
      active: !inactive.has(name.toLowerCase()),
      experience: q?.experience,
      notes: q?.notes,
    };
  });
}
