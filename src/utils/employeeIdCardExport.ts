import {toPng} from 'html-to-image';
import type {EmployeeIdCardPayload} from '../services/api/employeesApi';
import {
  formatExperienceYears,
  maskPhoneDisplay,
} from '../services/api/employeesApi';

const PRINT_HOST_ID = 'akanso-id-print-host';
const CAPTURE_HOST_ID = 'akanso-id-capture-host';

/** ISO CR80 ID card size. */
const CARD_W_MM = 85.6;
const CARD_H_MM = 54;
/** Raster capture width in CSS px (~300dpi-ish for screen capture). */
const CAPTURE_CARD_W = 520;
const CAPTURE_CARD_H = Math.round((CAPTURE_CARD_W * CARD_H_MM) / CARD_W_MM);

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wait for images; never hang forever (cross-origin / stalled loads). */
export function waitForImages(
  root: ParentNode,
  timeoutMs = 4000,
): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    void Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((r) => {
                img.addEventListener('load', () => r(), {once: true});
                img.addEventListener('error', () => r(), {once: true});
              }),
      ),
    ).then(() => {
      window.clearTimeout(timer);
      done();
    });
  });
}

async function urlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, {mode: 'cors', credentials: 'omit'});
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function cardShellCss(mode: 'print' | 'capture'): string {
  const cardSize =
    mode === 'print'
      ? `width:${CARD_W_MM}mm;height:${CARD_H_MM}mm;min-width:${CARD_W_MM}mm;min-height:${CARD_H_MM}mm;max-width:${CARD_W_MM}mm;max-height:${CARD_H_MM}mm;`
      : `width:${CAPTURE_CARD_W}px;height:${CAPTURE_CARD_H}px;`;

  return `
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f1c2e}
  .wrap{display:flex;flex-direction:column;align-items:center;gap:${mode === 'print' ? '12mm' : '20px'};padding:${mode === 'print' ? '0' : '16px'};background:#fff}
  .card{${cardSize}border:1px solid #d0d7de;border-radius:14px;overflow:hidden;background:#fff;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .silver{flex:0 0 auto;height:22%;min-height:44px;max-height:58px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;
    background:repeating-linear-gradient(0deg,rgba(255,255,255,.3) 0 1px,rgba(0,0,0,.03) 1px 2px),linear-gradient(180deg,#f6f7f9,#c9ced4);
    border-bottom:1px solid rgba(15,28,46,.1)}
  .brand{display:flex;align-items:center;gap:10px;min-width:0}
  .mark{width:34px;height:34px;object-fit:contain;flex-shrink:0}
  .logo{font-weight:800;letter-spacing:.14em;font-size:13px;color:#0f1c2e}
  .tag{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:650}
  .chip{width:28px;height:20px;border-radius:4px;background:linear-gradient(135deg,#d4af37,#f5e6a3,#a67c00);flex-shrink:0}
  .front{flex:1;min-height:0;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:10px 14px}
  .photo{width:72px;height:72px;border-radius:10px;object-fit:cover;border:2px solid #8bc4a4;display:flex;align-items:center;justify-content:center;background:#e8f5ee;font-weight:800;font-size:26px;color:#0f1c2e}
  .name{margin:0;font-size:15px;font-weight:800;text-transform:uppercase;color:#0f1c2e;letter-spacing:.03em;line-height:1.2}
  .role{margin:2px 0 8px;font-size:12px;font-weight:650;color:#1b7a4e}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin:0}
  .fields dt{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin:0}
  .fields dd{margin:0;font-size:11px;font-weight:700;color:#0f1c2e}
  .qrcol{display:flex;flex-direction:column;align-items:center;gap:4px}
  .qr{width:58px;height:58px;border:1px solid #e2e8f0;border-radius:6px;display:block}
  .footer-brand{font-size:10px;font-weight:750;color:#1b7a4e;letter-spacing:.08em;text-transform:uppercase}
  .back{flex:1;min-height:0;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:12px 16px}
  .copy{margin:0 0 6px;font-size:12px;line-height:1.4;color:#334155}
  .eid span{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
  .eid strong{display:block;font-size:14px;color:#0f1c2e;margin-top:2px}
  .auth{margin:6px 0 0;font-size:9px;font-weight:750;letter-spacing:.1em;text-transform:uppercase;color:#1b7a4e;text-align:center}
  .qr-lg{width:78px;height:78px;border:1px solid #e2e8f0;border-radius:6px;display:block}
  @media print{
    @page{size:A4 portrait;margin:12mm}
    html,body{width:auto!important;height:auto!important;overflow:visible!important}
    body{padding:0!important;margin:0!important;background:#fff!important}
    .wrap{gap:14mm;padding:0;width:100%}
    .card{
      width:${CARD_W_MM}mm!important;
      height:${CARD_H_MM}mm!important;
      min-width:${CARD_W_MM}mm!important;
      min-height:${CARD_H_MM}mm!important;
      max-width:${CARD_W_MM}mm!important;
      max-height:${CARD_H_MM}mm!important;
      transform:none!important;
      zoom:1!important;
    }
  }
`;
}

function buildCardMarkup(
  card: EmployeeIdCardPayload,
  opts?: {logoUrl?: string; photoUrl?: string},
): string {
  const profession = escapeHtml(card.profession || card.designation || '');
  const fullName = escapeHtml(card.fullName || '');
  const employeeCode = escapeHtml(card.employeeCode || '');
  const location = escapeHtml(card.location || '—');
  const experience = escapeHtml(formatExperienceYears(card.experienceYears));
  const phone = escapeHtml(maskPhoneDisplay(card.phone));
  const photoUrl = escapeHtml(opts?.photoUrl || card.photoUrl || '');
  const qr = escapeHtml(card.qrDataUrl || '');
  const logoUrl = escapeHtml(
    opts?.logoUrl || `${window.location.origin}/logo-mark.webp`,
  );
  const initial = escapeHtml(
    (card.fullName || '?').trim().slice(0, 1).toUpperCase(),
  );
  const photo = photoUrl
    ? `<img class="photo" src="${photoUrl}" alt=""/>`
    : `<div class="photo fallback">${initial}</div>`;

  return `<div class="wrap">
  <div class="card">
    <div class="silver"><div class="brand"><img class="mark" src="${logoUrl}" alt=""/><div><span class="logo">AKANSHO</span><span class="tag">Employee Identity</span></div></div><span class="chip"></span></div>
    <div class="front">
      ${photo}
      <div>
        <h2 class="name">${fullName}</h2>
        <p class="role">${profession}</p>
        <dl class="fields">
          <div><dt>Employee ID</dt><dd>${employeeCode}</dd></div>
          <div><dt>Experience</dt><dd>${experience}</dd></div>
          <div><dt>Phone</dt><dd>${phone}</dd></div>
          <div><dt>Location</dt><dd>${location}</dd></div>
        </dl>
      </div>
      <div class="qrcol"><img class="qr" src="${qr}" alt="QR"/><span class="footer-brand">Akansho</span></div>
    </div>
  </div>
  <div class="card">
    <div class="silver"><div><span class="logo">AKANSHO</span><span class="tag">Authorized Employee</span></div></div>
    <div class="back">
      <div>
        <p class="copy">This card identifies the holder as an authorized Akansho employee.</p>
        <p class="copy">If found, please return to Akansho.</p>
        <div class="eid"><span>Employee ID</span><strong>${employeeCode}</strong></div>
      </div>
      <div><img class="qr-lg" src="${qr}" alt="QR"/><p class="auth">Authorized Employee</p></div>
    </div>
  </div>
</div>`;
}

export function buildEmployeeIdCardHtml(
  card: EmployeeIdCardPayload,
  opts?: {logoUrl?: string; photoUrl?: string; mode?: 'print' | 'capture'},
): string {
  const mode = opts?.mode || 'print';
  const safeTitle = escapeHtml(`Akansho_Employee_ID_${card.employeeCode}`);
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
<style>${cardShellCss(mode)}</style></head><body>
${buildCardMarkup(card, opts)}
</body></html>`;
}

async function resolveAssetUrls(card: EmployeeIdCardPayload): Promise<{
  logoUrl: string;
  photoUrl: string;
}> {
  const [logoData, photoData] = await Promise.all([
    urlToDataUrl(`${window.location.origin}/logo-mark.webp`),
    card.photoUrl ? urlToDataUrl(card.photoUrl) : Promise.resolve(null),
  ]);
  return {
    logoUrl: logoData || `${window.location.origin}/logo-mark.webp`,
    photoUrl: photoData || card.photoUrl || '',
  };
}

function removeHost(id: string) {
  document.getElementById(id)?.remove();
}

/**
 * Print from a same-origin iframe using CR80 mm card sizes (no shrink-to-fit).
 */
export async function printEmployeeIdCardHtml(html: string): Promise<void> {
  removeHost(PRINT_HOST_ID);
  const host = document.createElement('div');
  host.id = PRINT_HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  // Keep iframe in-layout with real page geometry for print engines.
  host.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(host);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Employee ID card print');
  iframe.style.cssText = 'width:100%;height:100%;border:0;background:#fff;';
  host.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    removeHost(PRINT_HOST_ID);
    throw new Error('Print frame unavailable');
  }

  doc.open();
  doc.write(html);
  doc.close();

  if (doc.fonts?.ready) {
    try {
      await Promise.race([
        doc.fonts.ready,
        new Promise<void>((r) => setTimeout(r, 1500)),
      ]);
    } catch {
      /* ignore */
    }
  }
  await waitForImages(doc, 4000);
  // Allow layout to settle at mm sizes before print.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const cleanup = () => {
    window.setTimeout(() => removeHost(PRINT_HOST_ID), 800);
  };
  win.addEventListener('afterprint', cleanup, {once: true});
  window.setTimeout(cleanup, 60_000);

  win.focus();
  win.print();
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Build an off-screen capture host in the *main* document (not the Dialog).
 * Capturing the modal preview often yields a blank PNG due to overflow/stacking.
 */
async function captureIdCardPng(
  card: EmployeeIdCardPayload,
  assets: {logoUrl: string; photoUrl: string},
): Promise<Blob> {
  removeHost(CAPTURE_HOST_ID);
  const host = document.createElement('div');
  host.id = CAPTURE_HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${CAPTURE_CARD_W + 32}px`,
    'background:#ffffff',
    'z-index:2147483646',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  host.innerHTML = `<style>${cardShellCss('capture')}</style>${buildCardMarkup(card, assets)}`;
  document.body.appendChild(host);

  try {
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((r) => setTimeout(r, 1500)),
      ]);
    }
    await waitForImages(host, 4000);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const wrap = host.querySelector('.wrap') as HTMLElement | null;
    if (!wrap) throw new Error('Capture root missing');

    const dataUrl = await toPng(wrap, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: CAPTURE_CARD_W + 32,
      canvasWidth: (CAPTURE_CARD_W + 32) * 2,
      style: {
        margin: '0',
        transform: 'none',
        opacity: '1',
      },
    });

    if (!dataUrl || dataUrl.length < 200) {
      throw new Error('Empty PNG');
    }
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (!blob.size) throw new Error('Empty PNG blob');
    return blob;
  } finally {
    removeHost(CAPTURE_HOST_ID);
  }
}

/**
 * Download a real PNG of front+back. Never opens a blank tab.
 */
export async function downloadEmployeeIdCard(
  card: EmployeeIdCardPayload,
  _previewRoot?: HTMLElement | null,
): Promise<'png' | 'html'> {
  const baseName = `Akansho_Employee_ID_${card.employeeCode || 'card'}`;
  const assets = await resolveAssetUrls(card);

  try {
    const blob = await captureIdCardPng(card, assets);
    triggerBlobDownload(blob, `${baseName}.png`);
    return 'png';
  } catch {
    // Reliable fallback: self-contained HTML file (opens with cards visible).
    const html = buildEmployeeIdCardHtml(card, {
      ...assets,
      mode: 'print',
    });
    triggerBlobDownload(
      new Blob([html], {type: 'text/html;charset=utf-8'}),
      `${baseName}.html`,
    );
    return 'html';
  }
}

export async function preparePrintableIdCardHtml(
  card: EmployeeIdCardPayload,
): Promise<string> {
  const assets = await resolveAssetUrls(card);
  return buildEmployeeIdCardHtml(card, {
    ...assets,
    mode: 'print',
  });
}
