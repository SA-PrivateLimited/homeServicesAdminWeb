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
    primary: '#176B87',
    primaryDark: '#0F4C5C',
    secondary: '#2A9D8F',
    secondaryDark: '#217A70',
    background: '#F6F9FB',
    surface: '#FFFFFF',
    text: '#172B36',
    textSecondary: '#61737D',
    border: '#D9E3E8',
    error: '#D64545',
    success: '#2E8B57',
    warning: '#D98E04',
    sidebar: '#102A43',
    sidebarText: '#FFFFFF',
    sidebarMuted: '#A8BAC5',
    marketingBg: '#EAF6F5',
    marketingBgElevated: '#123B4A',
    marketingText: '#FFFFFF',
    marketingTextMuted: '#6A7F88',
    white: '#FFFFFF',
    black: '#000000',
  },
  facebook: {
    primary: '#4F46A5',
    primaryDark: '#37327F',
    secondary: '#7C5CFC',
    secondaryDark: '#6244D8',
    background: '#F7F7FC',
    surface: '#FFFFFF',
    text: '#20213A',
    textSecondary: '#686A80',
    border: '#E1E1EC',
    error: '#D64545',
    success: '#2E8B57',
    warning: '#C98505',
    sidebar: '#252344',
    sidebarText: '#FFFFFF',
    sidebarMuted: '#B5B3CC',
    marketingBg: '#F0EEFF',
    marketingBgElevated: '#312B63',
    marketingText: '#FFFFFF',
    marketingTextMuted: '#77749A',
    white: '#FFFFFF',
    black: '#000000',
  },
  google: {
    primary: '#2563A6',
    primaryDark: '#1D4F85',
    secondary: '#2F8F83',
    secondaryDark: '#247268',
    background: '#F5F9FA',
    surface: '#FFFFFF',
    text: '#18252B',
    textSecondary: '#63747A',
    border: '#DCE5E8',
    error: '#D64545',
    success: '#2F8F55',
    warning: '#C88712',
    sidebar: '#193442',
    sidebarText: '#FFFFFF',
    sidebarMuted: '#A8BBC2',
    marketingBg: '#EAF5F4',
    marketingBgElevated: '#214B58',
    marketingText: '#FFFFFF',
    marketingTextMuted: '#6C858D',
    white: '#FFFFFF',
    black: '#000000',
  },
};

export function resolveClientName(raw?: string | null): ClientName {
  const key = (raw || '').trim().toLowerCase() as ClientName;
  if (key && key in themeConfig) return key;
  return DEFAULT_CLIENT;
}
