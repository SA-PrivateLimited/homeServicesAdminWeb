/**
 * CustomerWeb greeting config — Super Admin configure via AdminWeb.
 */

import {apiGet, apiPut} from './apiClient';

export type GreetingState = 'LAUNCH' | 'NORMAL';
export type GreetingCloseMode = 'GLOBAL' | 'PER_PERSON';
export type GreetingAnimationMode =
  | 'AUTO'
  | 'CRACKERS'
  | 'DIYAS'
  | 'SPARKLE'
  | 'NONE';
export type GreetingAnimation = 'diyas' | 'sparkle' | 'crackers' | 'none';

export const GREETING_WISH_ICONS = [
  'celebration',
  'local_fire_department',
  'candlestick',
  'auto_awesome',
  'favorite',
  'local_florist',
  'spa',
  'volunteer_activism',
] as const;

export type GreetingWishIcon = string;

export const GREETING_PRESETS = [
  'Happy Holi',
  'Happy Diwali',
  'Happy New Year',
  'Happy Independence Day',
  'Merry Christmas',
] as const;

export const GREETING_ANIMATION_MODES = [
  'AUTO',
  'CRACKERS',
  'DIYAS',
  'SPARKLE',
  'NONE',
] as const;

export interface GreetingConfig {
  state: GreetingState;
  closeMode: GreetingCloseMode;
  waveId: string;
  eventName: string;
  greeting: string;
  cta: string;
  timerEndsAt: string | null;
  animationMode: GreetingAnimationMode;
  animation: GreetingAnimation;
  name: string;
  message: string;
  icon: GreetingWishIcon;
  logoAccentUrl: string;
  doodleEnabled: boolean;
  doodleEndsAt: string | null;
  doodleActive: boolean;
}

function normalizeIcon(raw: string | undefined): GreetingWishIcon {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (/^[a-z][a-z0-9_]{0,63}$/.test(value)) return value;
  return 'celebration';
}

function normalizeAnimationMode(raw: string | undefined): GreetingAnimationMode {
  const value = String(raw || '')
    .trim()
    .toUpperCase();
  if (
    value === 'DIYAS' ||
    value === 'SPARKLE' ||
    value === 'CRACKERS' ||
    value === 'NONE' ||
    value === 'AUTO'
  ) {
    return value;
  }
  if (value === 'JETS' || value === 'HOLI' || value === 'SNOW') {
    return 'SPARKLE';
  }
  return 'AUTO';
}

function normalize(raw: Partial<GreetingConfig> | null | undefined): GreetingConfig {
  const state =
    String(raw?.state || '')
      .trim()
      .toUpperCase() === 'LAUNCH'
      ? 'LAUNCH'
      : 'NORMAL';
  const greeting = String(raw?.greeting || '').trim() || 'Happy Holi';
  const timerRaw = String(raw?.timerEndsAt || '').trim();
  const timerMs = timerRaw ? Date.parse(timerRaw) : NaN;
  const animation = String(raw?.animation || '').trim();
  const resolvedAnimation: GreetingAnimation =
    animation === 'none'
      ? 'none'
      : animation === 'diyas'
        ? 'diyas'
        : animation === 'crackers'
          ? 'crackers'
          : 'sparkle';
  return {
    state,
    closeMode:
      String(raw?.closeMode || '')
        .trim()
        .toUpperCase() === 'GLOBAL'
        ? 'GLOBAL'
        : 'PER_PERSON',
    waveId: String(raw?.waveId || '').trim(),
    eventName: String(raw?.eventName || '').trim() || 'Akanso',
    greeting,
    cta: String(raw?.cta || '').trim() || greeting,
    timerEndsAt: Number.isFinite(timerMs) ? new Date(timerMs).toISOString() : null,
    animationMode: normalizeAnimationMode(raw?.animationMode),
    animation: resolvedAnimation,
    name: String(raw?.name || '').trim(),
    message: String(raw?.message || '').trim(),
    icon: normalizeIcon(raw?.icon),
    logoAccentUrl: String(raw?.logoAccentUrl || '').trim(),
    doodleEnabled: raw?.doodleEnabled === true,
    doodleEndsAt: Number.isFinite(
      Date.parse(String(raw?.doodleEndsAt || '').trim()),
    )
      ? new Date(String(raw?.doodleEndsAt)).toISOString()
      : null,
    doodleActive: raw?.doodleActive === true,
  };
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function endOfTodayDatetimeLocal(): string {
  const date = new Date();
  date.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(date.toISOString());
}

export interface DoodleConfig {
  doodleEnabled: boolean;
  doodleEndsAt: string | null;
  doodleActive: boolean;
  icon: GreetingWishIcon;
  logoAccentUrl: string;
}

function normalizeDoodle(raw: Partial<DoodleConfig> | null | undefined): DoodleConfig {
  return {
    doodleEnabled: raw?.doodleEnabled === true,
    doodleEndsAt: Number.isFinite(
      Date.parse(String(raw?.doodleEndsAt || '').trim()),
    )
      ? new Date(String(raw?.doodleEndsAt)).toISOString()
      : null,
    doodleActive: raw?.doodleActive === true,
    icon: normalizeIcon(raw?.icon),
    logoAccentUrl: String(raw?.logoAccentUrl || '').trim(),
  };
}

export async function getGreetingConfig(): Promise<GreetingConfig> {
  const data = await apiGet<GreetingConfig>('/api/greeting');
  return normalize(data);
}

export async function updateGreetingConfig(input: {
  state: GreetingState;
  closeMode: GreetingCloseMode;
  eventName: string;
  greeting: string;
  cta: string;
  timerEndsAt: string | null;
  animationMode: GreetingAnimationMode;
  name: string;
  message: string;
}): Promise<GreetingConfig> {
  const data = await apiPut<GreetingConfig>('/api/greeting', input);
  return normalize(data);
}

export async function getDoodleConfig(): Promise<DoodleConfig> {
  const data = await apiGet<DoodleConfig>('/api/greeting/doodle');
  return normalizeDoodle(data);
}

export async function updateDoodleConfig(input: {
  doodleEnabled: boolean;
  doodleEndsAt: string | null;
  icon: GreetingWishIcon;
  logoAccentUrl: string;
}): Promise<DoodleConfig> {
  const data = await apiPut<DoodleConfig>('/api/greeting/doodle', input);
  return normalizeDoodle(data);
}
