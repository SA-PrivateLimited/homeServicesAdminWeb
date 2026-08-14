import {apiDelete, apiGet, apiPost, apiPut, apiUploadFormData} from './apiClient';
import type {ClientColorPalette} from '../../theme/themeConfig';

export type {ClientColorPalette};

export interface BrandingClient {
  _id: string;
  name: string;
  customerProductName?: string;
  providerProductName?: string;
  logoUrl?: string;
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
  customerProductName: string;
  providerProductName: string;
  logoUrl: string;
  themeColors: ClientColorPalette;
}

export type ClientWriteInput = {
  _id?: string;
  name: string;
  customerProductName?: string;
  providerProductName?: string;
  logoUrl?: string;
  themeColors: ClientColorPalette;
};

export async function getBranding(): Promise<BrandingResponse> {
  return apiGet<BrandingResponse>('/api/branding', {skipAuth: true});
}

export async function getClients(): Promise<ClientsListResponse> {
  return apiGet<ClientsListResponse>('/api/admin/clients');
}

export async function createClient(
  input: ClientWriteInput,
): Promise<BrandingClient> {
  return apiPost<BrandingClient>('/api/admin/clients', input);
}

export async function updateClient(
  clientId: string,
  input: Partial<Omit<ClientWriteInput, '_id'>>,
): Promise<BrandingClient> {
  return apiPut<BrandingClient>(`/api/admin/clients/${clientId}`, input);
}

export async function uploadClientLogo(
  clientId: string,
  file: File,
): Promise<{logoUrl: string; client: BrandingClient}> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUploadFormData<{logoUrl: string; client: BrandingClient}>(
    `/api/admin/clients/${clientId}/logo`,
    formData,
  );
}

export async function activateClient(
  clientId: string,
): Promise<BrandingResponse> {
  return apiPut<BrandingResponse>(`/api/admin/clients/${clientId}/activate`);
}

export async function deleteClient(clientId: string): Promise<void> {
  await apiDelete(`/api/admin/clients/${clientId}`);
}
