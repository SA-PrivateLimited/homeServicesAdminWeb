import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';
import type { ClientColorPalette } from '../../theme/themeConfig';

export type { ClientColorPalette };

export interface BrandingClient {
  _id: string;
  name: string;
  themeColors: ClientColorPalette;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientsListResponse {
  activeClientId: string;
  clients: BrandingClient[];
}

export interface BrandingResponse {
  clientId: string;
  clientName: string;
  themeColors: ClientColorPalette;
}

export async function getBranding(): Promise<BrandingResponse> {
  return apiGet<BrandingResponse>('/api/branding', { skipAuth: true });
}

export async function getClients(): Promise<ClientsListResponse> {
  return apiGet<ClientsListResponse>('/api/admin/clients');
}

export async function createClient(input: {
  _id?: string;
  name: string;
  themeColors: ClientColorPalette;
}): Promise<BrandingClient> {
  return apiPost<BrandingClient>('/api/admin/clients', input);
}

export async function updateClient(
  clientId: string,
  input: { name?: string; themeColors?: ClientColorPalette },
): Promise<BrandingClient> {
  return apiPut<BrandingClient>(`/api/admin/clients/${clientId}`, input);
}

export async function activateClient(
  clientId: string,
): Promise<BrandingResponse> {
  return apiPut<BrandingResponse>(`/api/admin/clients/${clientId}/activate`);
}

export async function deleteClient(clientId: string): Promise<void> {
  await apiDelete(`/api/admin/clients/${clientId}`);
}
