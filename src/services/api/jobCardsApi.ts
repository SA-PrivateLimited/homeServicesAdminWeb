import { apiGet, apiGetPaginated, apiPost, apiPut } from './apiClient';

export interface JobAddress {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
}

export interface JobComment {
  _id: string;
  role: 'customer' | 'provider' | 'admin';
  authorId?: string;
  authorName?: string;
  text: string;
  createdAt?: string;
}

export interface JobCard {
  _id: string;
  status?: string;
  serviceType?: string;
  problem?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  providerId?: string;
  providerName?: string;
  providerPhone?: string;
  customerAddress?: string | JobAddress;
  providerAddress?: string | JobAddress;
  scheduledTime?: string;
  taskPIN?: string;
  pinGeneratedAt?: string;
  cancellationReason?: string;
  bookingId?: string;
  consultationId?: string;
  comments?: JobComment[];
  createdAt?: string;
  updatedAt?: string;
  customerNotified?: boolean;
  /** Present when row comes from a pending service request (no job card yet) */
  source?: 'jobCard' | 'serviceRequest';
}

export function isJobUnassigned(
  job: Pick<JobCard, 'providerId' | 'providerName' | 'status'>,
): boolean {
  if ((job.status || '') === 'unassigned') return true;
  const id = (job.providerId || '').trim();
  return !id || id === 'unassigned' || id === 'none';
}

export async function getJobCardsPage(options?: {
  status?: string;
  unassigned?: boolean;
  providerId?: string;
  customerId?: string;
  limit?: number;
  offset?: number;
}): Promise<{items: JobCard[]; total: number; limit: number; offset: number}> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.unassigned) params.set('unassigned', 'true');
  if (options?.providerId) params.set('providerId', options.providerId);
  if (options?.customerId) params.set('customerId', options.customerId);
  params.set('limit', String(options?.limit ?? 50));
  params.set('offset', String(options?.offset ?? 0));
  return apiGetPaginated<JobCard>(`/api/admin/jobCards?${params.toString()}`);
}

export async function getAllJobCards(options?: {
  status?: string;
  unassigned?: boolean;
}): Promise<JobCard[]> {
  const page = await getJobCardsPage({
    ...options,
    limit: 100,
    offset: 0,
  });
  return page.items;
}

export async function getJobCardById(
  jobCardId: string,
): Promise<JobCard | null> {
  try {
    return await apiGet<JobCard>(`/api/admin/jobCards/${jobCardId}`);
  } catch {
    return null;
  }
}

export async function updateJobCard(
  jobCardId: string,
  updates: Partial<JobCard>,
): Promise<JobCard> {
  return apiPut<JobCard>(`/api/admin/jobCards/${jobCardId}`, updates);
}

export async function assignProviderToJobCard(
  jobCardId: string,
  providerId: string,
  status: string = 'accepted',
): Promise<JobCard & {reassigned?: boolean}> {
  return apiPost<JobCard & {reassigned?: boolean}>(
    `/api/admin/jobCards/${jobCardId}/assign`,
    {
      providerId,
      status,
    },
  );
}

export async function unassignProviderFromJobCard(
  jobCardId: string,
): Promise<JobCard> {
  return apiPost<JobCard>(`/api/admin/jobCards/${jobCardId}/unassign`, {});
}

export async function addJobCardComment(
  jobCardId: string,
  text: string,
): Promise<JobCard> {
  return apiPost<JobCard>(`/api/admin/jobCards/${jobCardId}/comments`, {
    text,
  });
}
