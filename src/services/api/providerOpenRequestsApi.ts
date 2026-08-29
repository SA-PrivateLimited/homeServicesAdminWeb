import {apiGet, apiPut} from './apiClient';

export interface ProviderOpenRequestSettings {
  allowOfflineProviderOpenRequests: boolean;
}

export async function getProviderOpenRequestSettings(): Promise<ProviderOpenRequestSettings> {
  return apiGet<ProviderOpenRequestSettings>(
    '/api/admin/settings/provider-open-requests',
  );
}

export async function updateProviderOpenRequestSettings(
  allowOfflineProviderOpenRequests: boolean,
): Promise<ProviderOpenRequestSettings> {
  return apiPut<ProviderOpenRequestSettings>(
    '/api/admin/settings/provider-open-requests',
    {allowOfflineProviderOpenRequests},
  );
}
