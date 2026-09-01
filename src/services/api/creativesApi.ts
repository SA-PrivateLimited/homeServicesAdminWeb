import {resolveApiBaseUrl} from '../../config/api';
import {getStoredJwt} from '../backendAuth';
import {getStoredSuperAdminToken} from './superAdminApi';
import {apiDelete, apiGet, apiUploadFormData, ApiError} from './apiClient';

export interface BrandCreative {
  _id: string;
  label: string;
  originalName: string;
  url: string;
  contentType: string;
  size: number;
  createdAt?: string;
}

export async function listBrandCreatives(): Promise<BrandCreative[]> {
  const data = await apiGet<{items: BrandCreative[]}>('/api/admin/creatives');
  return data.items || [];
}

export async function uploadBrandCreative(
  file: File,
  label?: string,
): Promise<BrandCreative> {
  const form = new FormData();
  form.append('file', file);
  if (label?.trim()) form.append('label', label.trim());
  return apiUploadFormData<BrandCreative>('/api/admin/creatives', form, {
    timeout: 120000,
  });
}

export async function deleteBrandCreative(id: string): Promise<void> {
  await apiDelete(`/api/admin/creatives/${id}`);
}

export async function downloadBrandCreative(
  id: string,
  filename: string,
): Promise<void> {
  const blob = await fetchCreativeBlob(id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'akanso-creative.jpg';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function resolveCreativeUrl(url: string): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) {
    return `${resolveApiBaseUrl()}${raw}`;
  }
  return raw;
}

export async function fetchCreativeBlob(id: string): Promise<Blob> {
  const authToken = await getStoredJwt();
  const superAdminToken = getStoredSuperAdminToken();
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (superAdminToken) headers['X-Super-Admin-Token'] = superAdminToken;

  const base = resolveApiBaseUrl();
  const response = await fetch(`${base}/api/admin/creatives/${id}/download`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new ApiError(
      payload.message || 'Could not download this image.',
      response.status,
    );
  }
  return response.blob();
}
