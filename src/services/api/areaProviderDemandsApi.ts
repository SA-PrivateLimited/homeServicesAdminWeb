import {apiGet, apiPut} from './apiClient';

export interface AreaProviderDemand {
  _id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  serviceType: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getAreaProviderDemands(params?: {
  status?: string;
  limit?: number;
}): Promise<AreaProviderDemand[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  const data = await apiGet<AreaProviderDemand[]>(
    `/api/admin/area-provider-demands${qs ? `?${qs}` : ''}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function updateAreaProviderDemand(
  id: string,
  updates: {status?: AreaProviderDemand['status']; adminNotes?: string},
): Promise<AreaProviderDemand> {
  return apiPut<AreaProviderDemand>(
    `/api/admin/area-provider-demands/${id}`,
    updates,
  );
}
