import { apiGet, apiPut } from './apiClient';

export interface ContactRecommendation {
  _id: string;
  recommendedProviderName: string;
  recommendedProviderPhone: string;
  serviceType: string;
  address?: string;
  recommendedBy?: string;
  recommendedByName?: string;
  recommendedByPhone?: string;
  recommendedByLocation?: string;
  recommendedByRole: 'customer' | 'provider';
  status: 'pending' | 'contacted' | 'registered' | 'rejected';
  pointsAwarded?: number;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateContactInput {
  recommendedProviderName?: string;
  recommendedProviderPhone?: string;
  serviceType?: string;
  address?: string;
  status?: ContactRecommendation['status'];
  adminNotes?: string;
}

export async function getAllContactRecommendations(params?: {
  status?: string;
  serviceType?: string;
}): Promise<ContactRecommendation[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.serviceType) query.set('serviceType', params.serviceType);
  const qs = query.toString();
  const data = await apiGet<ContactRecommendation[]>(
    `/api/contactRecommendations${qs ? `?${qs}` : ''}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function updateRecommendationStatus(
  id: string,
  status: ContactRecommendation['status'],
  adminNotes?: string,
): Promise<ContactRecommendation> {
  return apiPut<ContactRecommendation>(
    `/api/contactRecommendations/${id}/status`,
    { status, adminNotes },
  );
}

export async function updateContactRecommendation(
  id: string,
  updates: UpdateContactInput,
): Promise<ContactRecommendation> {
  return apiPut<ContactRecommendation>(
    `/api/contactRecommendations/${id}`,
    updates,
  );
}
