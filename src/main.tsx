import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {applyColorPalette} from './theme';
import {
  loadRuntimeConfig,
  getApiBaseUrl,
  setRuntimeBranding,
  resolveLogoUrl,
} from './config/runtime';
import type {ClientColorPalette} from './theme/themeConfig';
import './i18n';
import {ToastProvider} from 'sapvt-ltd-web-packages';
import 'sapvt-ltd-web-packages/styles.css';
import './styles/global.css';
import './styles/scaling.css';
import App from './App';

/* Measure the browser's scrollbar width and expose it as a CSS variable.
   This lets the body-scroll-lock preserve layout width when overflow:hidden
   removes the scrollbar (preventing the page from jumping). */
function measureScrollbarWidth() {
  const w = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty('--scrollbar-width', `${w}px`);
}
measureScrollbarWidth();
window.addEventListener('resize', measureScrollbarWidth);

async function boot() {
  const config = await loadRuntimeConfig();
  applyColorPalette(config.themeColors, {clientId: 'local'});

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/branding`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const payload = (await res.json()) as {
        success?: boolean;
        data?: {
          clientId?: string;
          clientName?: string;
          customerProductName?: string;
          providerProductName?: string;
          logoUrl?: string;
          themeColors?: ClientColorPalette;
        };
      };
      const data = payload?.data;
      if (data?.themeColors) {
        applyColorPalette(data.themeColors, {
          clientId: data.clientId || 'remote',
        });
      }
      if (data) {
        const brandName =
          data.clientName?.trim() ||
          data.customerProductName?.trim() ||
          '';
        const logoUrl = resolveLogoUrl(data.logoUrl);
        setRuntimeBranding({
          brandName: brandName || undefined,
          logoUrl: logoUrl || undefined,
        });
        if (brandName) {
          document.title = `${brandName} Admin`;
        }
      }
    }
  } catch {
    // Keep config.json / local fallback themeColors
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StrictMode>,
  );
}

void boot();
