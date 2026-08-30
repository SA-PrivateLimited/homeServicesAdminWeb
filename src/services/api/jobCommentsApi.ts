import {apiGet, apiPut} from './apiClient';

export interface JobCommentsSettings {
  allowJobCardComments: boolean;
}

export async function getJobCommentsSettings(): Promise<JobCommentsSettings> {
  return apiGet<JobCommentsSettings>('/api/admin/settings/job-comments');
}

export async function updateJobCommentsSettings(
  allowJobCardComments: boolean,
): Promise<JobCommentsSettings> {
  return apiPut<JobCommentsSettings>('/api/admin/settings/job-comments', {
    allowJobCardComments,
  });
}
