/**
 * CustomerWeb launch config — Super Admin configure via AdminWeb.
 * CustomerWeb uses the same public GET; completion is POST /launch/complete (no admin token).
 */

import {apiGet, apiPut} from './apiClient';

export type LaunchState = 'LAUNCH' | 'NORMAL';

export interface LaunchConfig {
  state: LaunchState;
  name: string;
  message: string;
}

function normalize(raw: Partial<LaunchConfig> | null | undefined): LaunchConfig {
  const state =
    String(raw?.state || '')
      .trim()
      .toUpperCase() === 'LAUNCH'
      ? 'LAUNCH'
      : 'NORMAL';
  return {
    state,
    name: String(raw?.name || '').trim(),
    message: String(raw?.message || '').trim(),
  };
}

/** GET /api/launch — public status (also used by AdminWeb to load form). */
export async function getLaunchConfig(): Promise<LaunchConfig> {
  const data = await apiGet<LaunchConfig>('/api/launch');
  return normalize(data);
}

/** PUT /api/launch — Super Admin only (X-Super-Admin-Token attached by apiClient). */
export async function updateLaunchConfig(input: {
  state: LaunchState;
  name: string;
  message: string;
}): Promise<LaunchConfig> {
  const data = await apiPut<LaunchConfig>('/api/launch', {
    state: input.state,
    name: input.name,
    message: input.message,
  });
  return normalize(data);
}
