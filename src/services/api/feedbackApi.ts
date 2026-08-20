import {apiGet, apiPut} from './apiClient';

export type FeedbackStatus = 'new' | 'read' | 'resolved' | 'archived';
export type FeedbackApp = 'partner' | 'customer' | 'unknown';

export interface UserFeedback {
  _id: string;
  message: string;
  phone?: string;
  source?: string;
  app?: FeedbackApp;
  submittedBy?: string | null;
  submittedByRole?: string;
  status: FeedbackStatus;
  adminNotes?: string;
  userAgent?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function listFeedback(params?: {
  status?: FeedbackStatus | 'all';
  app?: FeedbackApp | 'all';
}): Promise<UserFeedback[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params?.app && params.app !== 'all') {
    query.set('app', params.app);
  }
  const qs = query.toString();
  const data = await apiGet<UserFeedback[]>(
    `/api/feedback${qs ? `?${qs}` : ''}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function updateFeedback(
  id: string,
  updates: {status?: FeedbackStatus; adminNotes?: string},
): Promise<UserFeedback> {
  return apiPut<UserFeedback>(`/api/feedback/${id}`, updates);
}
