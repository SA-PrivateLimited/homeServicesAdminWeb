import {toPng} from 'html-to-image';
import type {EmployeeIdCardPayload} from '../services/api/employeesApi';
import {
  formatExperienceYears,
  maskPhoneDisplay,
} from '../services/api/employeesApi';

const PRINT_HOST_ID = 'akanso-id-print-host';

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

export function buildEmployeeIdCardHtml(
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
  const safeTitle = escapeHtml(`Akansho_Employee_ID_${card.employeeCode}`);

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#fff;margin:0;padding:16px}
  .wrap{display:flex;flex-direction:column;gap:16px;align-items:center}
  .card{width:420px;height:265px;border:1px solid #d0d7de;border-radius:14px;overflow:hidden;background:#fff;display:flex;flex-direction:column;break-inside:avoid}
  .silver{height:52px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;
    background:repeating-linear-gradient(0deg,rgba(255,255,255,.3) 0 1px,rgba(0,0,0,.03) 1px 2px),linear-gradient(180deg,#f6f7f9,#c9ced4);
    border-bottom:1px solid rgba(15,28,46,.1)}
  .brand{display:flex;align-items:center;gap:10px}
  .mark{width:34px;height:34px;object-fit:contain}
  .logo{font-weight:800;letter-spacing:.14em;font-size:13px;color:#0f1c2e}
  .tag{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:650}
  .chip{width:28px;height:20px;border-radius:4px;background:linear-gradient(135deg,#d4af37,#f5e6a3,#a67c00)}
  .front{flex:1;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 14px}
  .photo{width:72px;height:72px;border-radius:10px;object-fit:cover;border:2px solid #8bc4a4;display:flex;align-items:center;justify-content:center;background:#e8f5ee;font-weight:800;font-size:26px;color:#0f1c2e}
  .name{margin:0;font-size:15px;font-weight:800;text-transform:uppercase;color:#0f1c2e;letter-spacing:.03em}
  .role{margin:2px 0 8px;font-size:12px;font-weight:650;color:#1b7a4e}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin:0}
  .fields dt{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin:0}
  .fields dd{margin:0;font-size:11px;font-weight:700;color:#0f1c2e}
  .qrcol{display:flex;flex-direction:column;align-items:center;gap:4px}
  .qr{width:58px;height:58px;border:1px solid #e2e8f0;border-radius:6px}
  .footer-brand{font-size:10px;font-weight:750;color:#1b7a4e;letter-spacing:.08em;text-transform:uppercase}
  .back{flex:1;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 16px}
  .copy{margin:0 0 6px;font-size:12px;line-height:1.4;color:#334155}
  .eid span{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
  .eid strong{display:block;font-size:14px;color:#0f1c2e;margin-top:2px}
  .auth{margin:6px 0 0;font-size:9px;font-weight:750;letter-spacing:.1em;text-transform:uppercase;color:#1b7a4e;text-align:center}
  @media print{
    @page{margin:10mm}
    body{padding:0}
    .wrap{gap:12mm}
    .card{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style></head><body>
<div class="wrap">
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
      <div><img class="qr" style="width:78px;height:78px" src="${qr}" alt="QR"/><p class="auth">Authorized Employee</p></div>
    </div>
  </div>
</div>
</body></html>`;
}

function removePrintHost() {
  document.getElementById(PRINT_HOST_ID)?.remove();
}

/**
 * Print from a body-level host (not inside Dialog) — avoids blank Chrome print.
 */
export async function printEmployeeIdCardHtml(html: string): Promise<void> {
  removePrintHost();
  const host = document.createElement('div');
  host.id = PRINT_HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  // Visible to the layout engine but off-screen for screen; print CSS shows it.
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:460px;background:#fff;z-index:-1;';
  document.body.appendChild(host);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Employee ID card print');
  iframe.style.cssText = 'width:460px;height:620px;border:0;';
  host.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    removePrintHost();
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

  const cleanup = () => {
    window.setTimeout(removePrintHost, 500);
  };
  win.addEventListener('afterprint', cleanup, {once: true});
  // Safari / some Chromium builds may not fire afterprint reliably.
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
 * Prefer PNG of the on-screen preview card; fall back to self-contained HTML.
 */
export async function downloadEmployeeIdCard(
  card: EmployeeIdCardPayload,
  previewRoot: HTMLElement | null,
): Promise<'png' | 'html'> {
  const baseName = `Akansho_Employee_ID_${card.employeeCode || 'card'}`;

  if (previewRoot) {
    try {
      if (document.fonts?.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise<void>((r) => setTimeout(r, 1500)),
        ]);
      }
      await waitForImages(previewRoot, 4000);

      // Inline remote photo when possible so canvas is not tainted.
      const photo = previewRoot.querySelector<HTMLImageElement>(
        '.akanso-id-card__photo:not(.akanso-id-card__photo--fallback)',
      );
      const logo = previewRoot.querySelector<HTMLImageElement>(
        '.akanso-id-card__logo',
      );
      const prevPhoto = photo?.src;
      const prevLogo = logo?.src;
      if (photo?.src) {
        const data = await urlToDataUrl(photo.src);
        if (data) photo.src = data;
      }
      if (logo?.src) {
        const data = await urlToDataUrl(logo.src);
        if (data) logo.src = data;
      }
      await waitForImages(previewRoot, 2000);

      const dataUrl = await toPng(previewRoot, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      if (photo && prevPhoto) photo.src = prevPhoto;
      if (logo && prevLogo) logo.src = prevLogo;

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      triggerBlobDownload(blob, `${baseName}.png`);
      return 'png';
    } catch {
      /* fall through to HTML */
    }
  }

  const [logoData, photoData] = await Promise.all([
    urlToDataUrl(`${window.location.origin}/logo-mark.webp`),
    card.photoUrl ? urlToDataUrl(card.photoUrl) : Promise.resolve(null),
  ]);
  const html = buildEmployeeIdCardHtml(card, {
    logoUrl: logoData || `${window.location.origin}/logo-mark.webp`,
    photoUrl: photoData || card.photoUrl || '',
  });
  triggerBlobDownload(
    new Blob([html], {type: 'text/html;charset=utf-8'}),
    `${baseName}.html`,
  );
  return 'html';
}

export async function preparePrintableIdCardHtml(
  card: EmployeeIdCardPayload,
): Promise<string> {
  const [logoData, photoData] = await Promise.all([
    urlToDataUrl(`${window.location.origin}/logo-mark.webp`),
    card.photoUrl ? urlToDataUrl(card.photoUrl) : Promise.resolve(null),
  ]);
  return buildEmployeeIdCardHtml(card, {
    logoUrl: logoData || `${window.location.origin}/logo-mark.webp`,
    photoUrl: photoData || card.photoUrl || '',
  });
}
