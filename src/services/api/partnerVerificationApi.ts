import {apiGet, apiPut} from './apiClient';

export type PartnerVerificationMode = 'AUTO' | 'ADMIN';

export interface PartnerVerificationSettings {
  partnerVerificationMode: PartnerVerificationMode;
  modes: PartnerVerificationMode[];
}

export async function getPartnerVerificationSettings(): Promise<PartnerVerificationSettings> {
  return apiGet<PartnerVerificationSettings>(
    '/api/admin/settings/partner-verification',
  );
}

export async function updatePartnerVerificationSettings(
  partnerVerificationMode: PartnerVerificationMode,
): Promise<PartnerVerificationSettings> {
  return apiPut<PartnerVerificationSettings>(
    '/api/admin/settings/partner-verification',
    {partnerVerificationMode},
  );
}
