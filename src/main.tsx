import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyColorPalette } from './theme';
import { loadRuntimeConfig, getApiBaseUrl } from './config/runtime';
import type { ClientColorPalette } from './theme/themeConfig';
import './i18n';
import 'sapvt-ltd-web-packages/styles.css';
import './styles/global.css';
import './styles/scaling.css';
import App from './App';

async function boot() {
  const config = await loadRuntimeConfig();
  applyColorPalette(config.themeColors, { clientId: 'local' });

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/branding`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const payload = (await res.json()) as {
        success?: boolean;
        data?: {
          clientId?: string;
          themeColors?: ClientColorPalette;
        };
      };
      if (payload?.data?.themeColors) {
        applyColorPalette(payload.data.themeColors, {
          clientId: payload.data.clientId || 'remote',
        });
      }
    }
  } catch {
    // Keep config.json / local fallback themeColors
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
