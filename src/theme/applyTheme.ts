import { hexToRgba, normalizeHex } from './colorUtils';
import {
  OPACITY_STEPS,
  resolveClientName,
  themeConfig,
  type ClientColorPalette,
  type ClientName,
} from './themeConfig';

/** Full CSS custom-property map for one client (solids + opacities). */
export type ColorPaletteCssVars = Record<string, string>;

let activeClientId: string = 'homeservices';
let activeThemeColors: ClientColorPalette = themeConfig.homeservices;

function opacitySuffix(pct: number): string {
  return pct < 10 ? `0${pct}` : String(pct);
}

function opacityToken(base: string, pct: number): string {
  return `${base}-opacity-${opacitySuffix(pct)}`;
}

function withOpacities(
  vars: ColorPaletteCssVars,
  cssName: string,
  hex: string,
): void {
  for (const pct of OPACITY_STEPS) {
    vars[opacityToken(cssName, pct)] = hexToRgba(hex, pct / 100);
  }
}

/**
 * Build CSS vars from a themeColors / colorPalette object.
 */
export function buildColorPaletteFromColors(
  p: ClientColorPalette,
): ColorPaletteCssVars {
  const primary = normalizeHex(p.primary);
  const primaryDark = normalizeHex(p.primaryDark);
  const secondary = normalizeHex(p.secondary);
  const secondaryDark = normalizeHex(p.secondaryDark);
  const background = normalizeHex(p.background);
  const surface = normalizeHex(p.surface);
  const text = normalizeHex(p.text);
  const textSecondary = normalizeHex(p.textSecondary);
  const border = normalizeHex(p.border);
  const error = normalizeHex(p.error);
  const success = normalizeHex(p.success);
  const warning = normalizeHex(p.warning);
  const sidebar = normalizeHex(p.sidebar);
  const sidebarText = normalizeHex(p.sidebarText);
  const sidebarMuted = normalizeHex(p.sidebarMuted);
  const marketingBg = normalizeHex(p.marketingBg);
  const marketingBgElevated = normalizeHex(p.marketingBgElevated);
  const marketingText = normalizeHex(p.marketingText);
  const marketingTextMuted = normalizeHex(p.marketingTextMuted);
  const white = normalizeHex(p.white);
  const black = normalizeHex(p.black);

  const vars: ColorPaletteCssVars = {
    '--primary-color': primary,
    '--primary-color-2': primaryDark,
    '--secondary-color': secondary,
    '--secondary-color-2': secondaryDark,
    '--color-bg': background,
    '--color-surface': surface,
    '--color-card': surface,
    '--color-text': text,
    '--color-text-secondary': textSecondary,
    '--color-border': border,
    '--color-error': error,
    '--warning-red': error,
    '--color-success': success,
    '--color-warning': warning,
    '--color-sidebar': sidebar,
    '--color-sidebar-text': sidebarText,
    '--color-sidebar-muted': sidebarMuted,
    '--marketing-bg': marketingBg,
    '--marketing-bg-elevated': marketingBgElevated,
    '--marketing-text': marketingText,
    '--marketing-text-muted': marketingTextMuted,
    '--neutral-white': white,
    '--neutral-black': black,

    '--color-primary': primary,
    '--color-primary-dark': primaryDark,
    '--color-secondary': secondary,

    '--hs-primary': primary,
    '--hs-primary-dark': primaryDark,
    '--hs-secondary': secondary,
    '--hs-surface': surface,
    '--hs-text': text,
    '--hs-text-secondary': textSecondary,
    '--hs-border': border,
    '--hs-error': error,
    '--hs-success': success,
    '--hs-warning': warning,
  };

  const opacityBases: Array<[string, string]> = [
    ['--primary-color', primary],
    ['--primary-color-2', primaryDark],
    ['--secondary-color', secondary],
    ['--secondary-color-2', secondaryDark],
    ['--color-bg', background],
    ['--color-surface', surface],
    ['--color-text', text],
    ['--color-error', error],
    ['--color-success', success],
    ['--color-warning', warning],
    ['--color-sidebar', sidebar],
    ['--marketing-bg', marketingBg],
    ['--marketing-bg-elevated', marketingBgElevated],
    ['--neutral-white', white],
    ['--neutral-black', black],
  ];

  for (const [name, hex] of opacityBases) {
    withOpacities(vars, name, hex);
  }

  vars['--primary-opacity-05'] = vars['--primary-color-opacity-05'];
  vars['--primary-opacity-10'] = vars['--primary-color-opacity-10'];
  vars['--secondary-opacity-05'] = vars['--secondary-color-opacity-05'];
  vars['--secondary-opacity-10'] = vars['--secondary-color-opacity-10'];
  vars['--warning-red-opacity-10'] = vars['--color-error-opacity-10'];
  vars['--warning-red-opacity-12'] = vars['--color-error-opacity-12'];

  vars['--shadow-sm'] =
    `0 1px 2px ${vars['--neutral-black-opacity-06']}, 0 4px 12px ${vars['--neutral-black-opacity-04']}`;
  vars['--shadow-md'] = `0 18px 40px ${vars['--neutral-black-opacity-20']}`;
  vars['--shadow-lg'] = `0 18px 40px ${vars['--neutral-black-opacity-25']}`;

  return vars;
}

/** @deprecated Prefer buildColorPaletteFromColors — kept for static fallbacks */
export function buildColorPalette(
  clientName: ClientName | string,
): ColorPaletteCssVars {
  const client = resolveClientName(clientName);
  return buildColorPaletteFromColors(themeConfig[client]);
}

/**
 * Apply a themeColors object as the live colorPalette.
 */
export function applyColorPalette(
  themeColors: ClientColorPalette,
  options?: { clientId?: string; target?: HTMLElement },
): void {
  const target = options?.target ?? document.documentElement;
  activeThemeColors = themeColors;
  if (options?.clientId) {
    activeClientId = options.clientId;
  }
  const vars = buildColorPaletteFromColors(themeColors);
  Object.entries(vars).forEach(([key, value]) => {
    target.style.setProperty(key, value);
  });
  target.dataset.client = activeClientId;
}

/** Apply by static client name (fallback only). */
export function applyColorPaletteByClientName(
  clientName?: string | null,
  target: HTMLElement = document.documentElement,
): ClientName {
  const client = resolveClientName(clientName);
  applyColorPalette(themeConfig[client], { clientId: client, target });
  return client;
}

export function getActiveClientName(): string {
  return activeClientId;
}

export function getActiveThemeColors(): ClientColorPalette {
  return activeThemeColors;
}

export function getClientPrimary(_clientName?: string | null): string {
  return activeThemeColors.primary;
}
