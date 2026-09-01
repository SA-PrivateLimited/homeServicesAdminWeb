import {resolveApiBaseUrl, API_TIMEOUT} from '../../config/api';
import {getStoredJwt} from '../backendAuth';
import {getStoredSuperAdminToken} from './superAdminApi';
import {apiGet, apiUploadFormData, ApiError} from './apiClient';

export const RESTORE_CONFIRM_PHRASE = 'RESTORE';

export interface BackupCollectionStat {
  name: string;
  documentCount: number;
}

export interface BackupActivityEvent {
  id: string;
  type: 'export' | 'restore';
  at: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  collectionCount: number;
  documentCount: number;
  collections: string[];
}

export interface BackupSummary {
  database: string;
  collectionCount: number;
  documentCount: number;
  collections: BackupCollectionStat[];
  restoreConfirmPhrase: string;
  events: BackupActivityEvent[];
}

export interface RestoreResult {
  database: string;
  restoredCollections: number;
  collections: BackupCollectionStat[];
}

export async function getBackupSummary(): Promise<BackupSummary> {
  return apiGet<BackupSummary>('/api/admin/backups/summary');
}

export async function downloadDatabaseBackup(
  collections?: string[],
): Promise<void> {
  const authToken = await getStoredJwt();
  const superAdminToken = getStoredSuperAdminToken();
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (superAdminToken) headers['X-Super-Admin-Token'] = superAdminToken;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120000);
  const base = resolveApiBaseUrl();
  const params =
    collections && collections.length
      ? `?collections=${encodeURIComponent(collections.join(','))}`
      : '';
  try {
    const response = await fetch(`${base}/api/admin/backups/export${params}`, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new ApiError(
        payload.message || 'Could not download the backup.',
        response.status,
      );
    }
    const blob = await response.blob();
    const header = response.headers.get('Content-Disposition') || '';
    const match = /filename="([^"]+)"/.exec(header);
    const filename = match?.[1] || `akanso-db-backup-${Date.now()}.json`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } finally {
    window.clearTimeout(timer);
  }
}

export async function restoreDatabaseBackup(
  file: File,
  confirm: string,
  collections?: string[],
): Promise<RestoreResult> {
  const form = new FormData();
  form.append('backup', file);
  form.append('confirm', confirm);
  if (collections?.length) {
    form.append('collections', collections.join(','));
  }
  return apiUploadFormData<RestoreResult>('/api/admin/backups/restore', form, {
    timeout: Math.max(API_TIMEOUT, 120000),
  });
}
