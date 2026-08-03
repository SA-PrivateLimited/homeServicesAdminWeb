export {
  themeConfig,
  resolveClientName,
  DEFAULT_CLIENT,
  OPACITY_STEPS,
  type ClientName,
  type ClientColorPalette,
} from './themeConfig';
export {
  applyColorPalette,
  applyColorPaletteByClientName,
  buildColorPalette,
  buildColorPaletteFromColors,
  getActiveClientName,
  getActiveThemeColors,
  getClientPrimary,
  type ColorPaletteCssVars,
} from './applyTheme';
export { hexToRgba, hexToRgb, normalizeHex } from './colorUtils';
