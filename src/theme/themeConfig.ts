/**
 * Static fallback client palettes (seed / offline).
 * Live theme comes from GET /api/branding → themeColors → applyColorPalette.
 * Base keys are solid hex. Opacity variants are derived at apply-time.
 */

export type ClientName = 'homeservices' | 'facebook' | 'google';

/** Solid brand tokens every client must define. */
export interface ClientColorPalette {
  primary: string;
  primaryDark: string;
  secondary: string;
  secondaryDark: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  sidebar: string;
  sidebarText: string;
  sidebarMuted: string;
  /** Marketing / dark chrome (Website) */
  marketingBg: string;
  marketingBgElevated: string;
  marketingText: string;
  marketingTextMuted: string;
  white: string;
  black: string;
}

export const DEFAULT_CLIENT: ClientName = 'homeservices';

/**
 * Opacity steps actually used in AdminWeb + Website stylesheets.
 * Keep this list in sync with baseline.md § Opacity inventory.
 */
export const OPACITY_STEPS = [
  4, 5, 6, 8, 10, 12, 15, 16, 20, 25, 30, 35, 45, 50, 60, 70, 80, 88, 90,
] as const;

export const themeConfig: Record<ClientName, ClientColorPalette> = {
  homeservices: {
    primary: '#3182CE',
    primaryDark: '#2C5282',
    secondary: '#38B2AC',
    secondaryDark: '#2C7A7B',
    background: '#F5F7FA',
    surface: '#FFFFFF',
    text: '#1A202C',
    textSecondary: '#718096',
    border: '#E2E8F0',
    error: '#E53E3E',
    success: '#38A169',
    warning: '#DD6B20',
    sidebar: '#1A202C',
    sidebarText: '#EDF2F7',
    sidebarMuted: '#A0AEC0',
    marketingBg: '#0F1C2E',
    marketingBgElevated: '#17263B',
    marketingText: '#F7FAFC',
    marketingTextMuted: '#A0AEC0',
    white: '#FFFFFF',
    black: '#000000',
  },
  facebook: {
    primary: '#E91E8C',
    primaryDark: '#C2185B',
    secondary: '#F48FB1',
    secondaryDark: '#EC407A',
    background: '#FFF5F8',
    surface: '#FFFFFF',
    text: '#2D1420',
    textSecondary: '#8D6B7A',
    border: '#F5D0DC',
    error: '#E53935',
    success: '#43A047',
    warning: '#FB8C00',
    sidebar: '#4A1528',
    sidebarText: '#FFE8F0',
    sidebarMuted: '#D4A0B4',
    marketingBg: '#3D1022',
    marketingBgElevated: '#5C1A35',
    marketingText: '#FFFFFF',
    marketingTextMuted: '#E8B4C8',
    white: '#FFFFFF',
    black: '#000000',
  },
  google: {
    primary: '#1A73E8',
    primaryDark: '#174EA6',
    secondary: '#34A853',
    secondaryDark: '#188038',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    text: '#202124',
    textSecondary: '#5F6368',
    border: '#DADCE0',
    error: '#D93025',
    success: '#188038',
    warning: '#F9AB00',
    sidebar: '#202124',
    sidebarText: '#FFFFFF',
    sidebarMuted: '#9AA0A6',
    marketingBg: '#202124',
    marketingBgElevated: '#3C4043',
    marketingText: '#FFFFFF',
    marketingTextMuted: '#9AA0A6',
    white: '#FFFFFF',
    black: '#000000',
  },
};

export function resolveClientName(raw?: string | null): ClientName {
  const key = (raw || '').trim().toLowerCase() as ClientName;
  if (key && key in themeConfig) return key;
  return DEFAULT_CLIENT;
}
