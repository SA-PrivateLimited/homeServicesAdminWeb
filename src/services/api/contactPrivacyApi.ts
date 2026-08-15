import {apiGet, apiPut} from './apiClient';

export type ProviderContactPolicy =
  | 'DIRECT'
  | 'MASKED'
  | 'ACCEPTED_ONLY'
  | 'ACTIVE_REQUEST_ONLY';

export interface ContactPrivacySettings {
  providerContactPolicy: ProviderContactPolicy;
  serviceOverrides: Record<string, ProviderContactPolicy>;
  policies: ProviderContactPolicy[];
}

export interface ContactPrivacyAuditRow {
  previousPolicy: ProviderContactPolicy;
  newPolicy: ProviderContactPolicy;
  changedBy: string;
  changedAt: string;
}

export async function getContactPrivacySettings(): Promise<ContactPrivacySettings> {
  return apiGet<ContactPrivacySettings>('/api/admin/settings/contact-privacy');
}

export async function updateContactPrivacySettings(
  providerContactPolicy: ProviderContactPolicy,
): Promise<ContactPrivacySettings> {
  return apiPut<ContactPrivacySettings>('/api/admin/settings/contact-privacy', {
    providerContactPolicy,
  });
}

export async function getContactPrivacyAudit(
  limit = 20,
): Promise<ContactPrivacyAuditRow[]> {
  const data = await apiGet<ContactPrivacyAuditRow[]>(
    `/api/admin/settings/contact-privacy/audit?limit=${limit}`,
  );
  return Array.isArray(data) ? data : [];
}
