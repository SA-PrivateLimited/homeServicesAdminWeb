/**
 * CustomerWeb launch config — Super Admin configure via AdminWeb.
 */

import {apiGet, apiPut} from './apiClient';

export type LaunchState = 'LAUNCH' | 'NORMAL';
export type LaunchCloseMode = 'GLOBAL' | 'PER_PERSON';
export type LaunchAnimationMode =
  | 'AUTO'
  | 'CRACKERS'
  | 'DIYAS'
  | 'JETS'
  | 'HOLI'
  | 'SNOW'
  | 'SPARKLE'
  | 'NONE';
export type LaunchAnimation =
  | 'crackers'
  | 'diyas'
  | 'jets'
  | 'holi'
  | 'snow'
  | 'sparkle'
  | 'none';

export const LAUNCH_WISH_ICONS = [
  'celebration',
  'favorite',
  'auto_awesome',
  'volunteer_activism',
  'local_florist',
  'spa',
] as const;

export type LaunchWishIcon = (typeof LAUNCH_WISH_ICONS)[number];

export const LAUNCH_GREETING_PRESETS = [
  'Happy Holi',
  'Happy Diwali',
  'Happy New Year',
  'Happy Independence Day',
  'Merry Christmas',
] as const;

export const LAUNCH_COUNTDOWN_PRESETS = [3, 5, 8, 10, 15] as const;

export const LAUNCH_ANIMATION_MODES = [
  'AUTO',
  'CRACKERS',
  'DIYAS',
  'JETS',
  'HOLI',
  'SNOW',
  'SPARKLE',
  'NONE',
] as const;

export interface LaunchConfig {
  state: LaunchState;
  closeMode: LaunchCloseMode;
  waveId: string;
  eventName: string;
  greeting: string;
  cta: string;
  countdownSeconds: number;
  animationMode: LaunchAnimationMode;
  animation: LaunchAnimation;
  name: string;
  message: string;
  icon: LaunchWishIcon;
}

function normalizeIcon(raw: string | undefined): LaunchWishIcon {
  const value = String(raw || '').trim();
  return (LAUNCH_WISH_ICONS as readonly string[]).includes(value)
    ? (value as LaunchWishIcon)
    : 'celebration';
}

function normalizeAnimationMode(raw: string | undefined): LaunchAnimationMode {
  const value = String(raw || '')
    .trim()
    .toUpperCase();
  return (LAUNCH_ANIMATION_MODES as readonly string[]).includes(value)
    ? (value as LaunchAnimationMode)
    : 'AUTO';
}

function normalize(raw: Partial<LaunchConfig> | null | undefined): LaunchConfig {
  const state =
    String(raw?.state || '')
      .trim()
      .toUpperCase() === 'LAUNCH'
      ? 'LAUNCH'
      : 'NORMAL';
  const greeting = String(raw?.greeting || '').trim() || 'Happy Holi';
  const parsed = Number.parseInt(String(raw?.countdownSeconds ?? ''), 10);
  const animation = String(raw?.animation || '').trim() as LaunchAnimation;
  const allowed: LaunchAnimation[] = [
    'crackers',
    'diyas',
    'jets',
    'holi',
    'snow',
    'sparkle',
    'none',
  ];
  return {
    state,
    closeMode:
      String(raw?.closeMode || '')
        .trim()
        .toUpperCase() === 'PER_PERSON'
        ? 'PER_PERSON'
        : 'GLOBAL',
    waveId: String(raw?.waveId || '').trim(),
    eventName: String(raw?.eventName || '').trim() || 'Akanso',
    greeting,
    cta: String(raw?.cta || '').trim() || greeting,
    countdownSeconds: Number.isFinite(parsed)
      ? Math.min(30, Math.max(0, parsed))
      : 10,
    animationMode: normalizeAnimationMode(raw?.animationMode),
    animation: allowed.includes(animation) ? animation : 'crackers',
    name: String(raw?.name || '').trim(),
    message: String(raw?.message || '').trim(),
    icon: normalizeIcon(raw?.icon),
  };
}

export async function getLaunchConfig(): Promise<LaunchConfig> {
  const data = await apiGet<LaunchConfig>('/api/launch');
  return normalize(data);
}

export async function updateLaunchConfig(input: {
  state: LaunchState;
  closeMode: LaunchCloseMode;
  eventName: string;
  greeting: string;
  cta: string;
  countdownSeconds: number;
  animationMode: LaunchAnimationMode;
  name: string;
  message: string;
  icon: LaunchWishIcon;
}): Promise<LaunchConfig> {
  const data = await apiPut<LaunchConfig>('/api/launch', {
    state: input.state,
    closeMode: input.closeMode,
    eventName: input.eventName,
    greeting: input.greeting,
    cta: input.cta,
    countdownSeconds: input.countdownSeconds,
    animationMode: input.animationMode,
    name: input.name,
    message: input.message,
    icon: input.icon,
  });
  return normalize(data);
}
