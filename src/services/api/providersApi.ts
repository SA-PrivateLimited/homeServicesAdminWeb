import { apiGet, apiGetPaginated, apiPut, apiUploadFormData } from './apiClient';
import { resolveApiBaseUrl } from '../../config/api';

export interface ProviderLocation {
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  stateId?: string;
  districtId?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface Provider {
  _id: string;
  name?: string;
  displayName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  serviceType?: string;
  specialization?: string;
  serviceCategories?: string[];
  experience?: number;
  serviceFee?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | string;
  status?: string;
  verified?: boolean;
  rating?: number;
  profileImage?: string;
  loginPin?: string | null;
  hasPin?: boolean;
  userId?: string;
  isActive?: boolean;
  deactivationReason?: string;
  location?: ProviderLocation;
  address?: string | ProviderLocation;
  currentLocation?: ProviderLocation;
  documents?: Record<string, string | boolean | undefined>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProviderFilters {
  approvalStatus?: string;
  serviceType?: string;
  city?: string;
  state?: string;
  district?: string;
  stateId?: string;
  districtId?: string;
  pincode?: string;
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}

export async function getProvidersPage(
  filters?: ProviderFilters,
): Promise<{items: Provider[]; total: number; limit: number; offset: number}> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  if (!params.has('limit')) params.set('limit', '50');
  if (!params.has('offset')) params.set('offset', '0');
  const qs = params.toString();
  return apiGetPaginated<Provider>(`/api/providers?${qs}`);
}

export async function getProviders(filters?: ProviderFilters): Promise<Provider[]> {
  const page = await getProvidersPage({
    ...filters,
    limit: filters?.limit ?? 100,
    offset: filters?.offset ?? 0,
  });
  return page.items;
}

export async function getProviderById(providerId: string): Promise<Provider | null> {
  try {
    return await apiGet<Provider>(`/api/providers/${providerId}`);
  } catch {
    return null;
  }
}

export async function updateProvider(
  providerId: string,
  updates: Partial<Provider> & {
    location?: ProviderLocation;
  },
): Promise<Provider> {
  return apiPut<Provider>(`/api/providers/${providerId}`, updates);
}

export async function updateProviderApproval(
  providerId: string,
  approvalStatus: 'approved' | 'rejected' | 'pending',
  rejectionReason?: string,
): Promise<Provider> {
  const body: { approvalStatus: string; rejectionReason?: string } = {
    approvalStatus,
  };
  if (rejectionReason) body.rejectionReason = rejectionReason;
  return apiPut<Provider>(`/api/providers/${providerId}/approval`, body);
}

export type ProviderDocKey = 'idProof' | 'addressProof' | 'certificate';

export async function uploadProviderDocument(
  providerId: string,
  docKey: ProviderDocKey,
  file: File,
): Promise<{url: string; documents?: Provider['documents']; provider?: Provider}> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUploadFormData(
    `/api/providers/${providerId}/documents/${docKey}`,
    formData,
  );
}

/** Resolve relative upload URLs against API origin. */
export function resolveUploadUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${resolveApiBaseUrl()}${url}`;
  return url;
}
