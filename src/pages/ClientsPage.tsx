import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  VirtualTable,
  type VirtualTableColumn,
  Button,
  Dialog,
  StatusChip,
} from 'sapvt-ltd-web-packages';
import {
  activateClient,
  createClient,
  deleteClient,
  getClients,
  updateClient,
  uploadClientLogo,
  type BrandingClient,
  type ClientColorPalette,
} from '../services/api/clientsApi';
import {useAuthStore} from '../store/authStore';
import {applyColorPalette} from '../theme';
import {themeConfig} from '../theme/themeConfig';
import {resolveLogoUrl, setRuntimeBranding} from '../config/runtime';
import {sortByUpdatedThenCreated} from '../utils/sort';
import '../styles/pages.css';

const THEME_COLOR_KEYS = Object.keys(
  themeConfig.homeservices,
) as Array<keyof ClientColorPalette>;

const THEME_SECTIONS: Array<{
  title: string;
  description: string;
  keys: Array<keyof ClientColorPalette>;
}> = [
  {
    title: 'Brand',
    description: 'Core brand and action colors used across the apps.',
    keys: ['primary', 'primaryDark', 'secondary', 'secondaryDark'],
  },
  {
    title: 'Foundation',
    description: 'Application backgrounds, surfaces, text, and borders.',
    keys: ['background', 'surface', 'text', 'textSecondary', 'border'],
  },
  {
    title: 'Status',
    description: 'Semantic colors for success, warning, and destructive states.',
    keys: ['success', 'warning', 'error'],
  },
  {
    title: 'Navigation',
    description: 'Sidebar background and navigation text colors.',
    keys: ['sidebar', 'sidebarText', 'sidebarMuted'],
  },
  {
    title: 'Marketing',
    description: 'Promo and dark accent surfaces shared across applications.',
    keys: ['marketingBg', 'marketingBgElevated', 'marketingText', 'marketingTextMuted'],
  },
  {
    title: 'Base',
    description: 'Absolute base colors used for contrast and overlays.',
    keys: ['white', 'black'],
  },
];

const COLOR_LABELS: Record<keyof ClientColorPalette, string> = {
  primary: 'Primary',
  primaryDark: 'Primary dark',
  secondary: 'Secondary',
  secondaryDark: 'Secondary dark',
  background: 'Background',
  surface: 'Surface',
  text: 'Text',
  textSecondary: 'Text secondary',
  border: 'Border',
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
  sidebar: 'Sidebar',
  sidebarText: 'Sidebar text',
  sidebarMuted: 'Sidebar muted',
  marketingBg: 'Marketing bg',
  marketingBgElevated: 'Marketing elevated',
  marketingText: 'Marketing text',
  marketingTextMuted: 'Marketing muted',
  white: 'White',
  black: 'Black',
};

const THEME_PRESETS: Array<{
  id: string;
  label: string;
  palette: ClientColorPalette;
}> = [
  {
    id: 'akanso-professional',
    label: 'Akanso Professional',
    palette: {
      primary: '#176B87',
      primaryDark: '#0F4C5C',
      secondary: '#2A9D8F',
      secondaryDark: '#217A70',
      background: '#F6F9FB',
      surface: '#FFFFFF',
      text: '#172B36',
      textSecondary: '#61737D',
      border: '#D9E3E8',
      success: '#2E8B57',
      warning: '#D98E04',
      error: '#D64545',
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
  },
  {
    id: 'indigo-professional',
    label: 'Indigo Professional',
    palette: {
      primary: '#4F46A5',
      primaryDark: '#37327F',
      secondary: '#7C5CFC',
      secondaryDark: '#6244D8',
      background: '#F7F7FC',
      surface: '#FFFFFF',
      text: '#20213A',
      textSecondary: '#686A80',
      border: '#E1E1EC',
      success: '#2E8B57',
      warning: '#C98505',
      error: '#D64545',
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
  },
  {
    id: 'blue-emerald-professional',
    label: 'Blue & Emerald Professional',
    palette: {
      primary: '#2563A6',
      primaryDark: '#1D4F85',
      secondary: '#2F8F83',
      secondaryDark: '#247268',
      background: '#F5F9FA',
      surface: '#FFFFFF',
      text: '#18252B',
      textSecondary: '#63747A',
      border: '#DCE5E8',
      success: '#2F8F55',
      warning: '#C88712',
      error: '#D64545',
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
  },
];

const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function clonePalette(p: ClientColorPalette): ClientColorPalette {
  return {...p};
}

type ClientDraft = {
  _id: string;
  name: string;
  customerProductName: string;
  providerProductName: string;
  logoUrl: string;
  themeColors: ClientColorPalette;
};

function emptyDraft(): ClientDraft {
  return {
    _id: '',
    name: '',
    customerProductName: '',
    providerProductName: '',
    logoUrl: '',
    themeColors: clonePalette(themeConfig.homeservices),
  };
}

function normalizeColorInput(hex: string): string {
  const v = (hex || '#000000').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#000000';
}

function isValidHexColor(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test((hex || '').trim());
}

function palettesEqual(a: ClientColorPalette, b: ClientColorPalette): boolean {
  return THEME_COLOR_KEYS.every(
    (key) => normalizeColorInput(a[key]) === normalizeColorInput(b[key]),
  );
}

function resolveLogoSrc(logoUrl?: string): string {
  return resolveLogoUrl(logoUrl);
}

export function ClientsPage() {
  const {t} = useTranslation();
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);
  const [clients, setClients] = useState<BrandingClient[]>([]);
  const [activeClientId, setActiveClientId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadLogoError, setUploadLogoError] = useState<string | null>(null);
  const [uploadLogoSuccess, setUploadLogoSuccess] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);
  // localLogoPreview: blob: URL while uploading; resolved server URL after success
  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);
  // track blob URL separately so we can revoke it only after we switch preview
  const pendingBlobRef = useRef<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClients();
      setClients(sortByUpdatedThenCreated(data.clients));
      setActiveClientId(data.activeClientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!superAdminElevated) return;
    void load();
  }, [load, superAdminElevated]);

  useEffect(() => {
    setLogoPreviewFailed(false);
  }, [localLogoPreview, draft.logoUrl]);

  if (!superAdminElevated) {
    return <Navigate to="/" replace />;
  }

  const closeEditor = () => {
    if (pendingBlobRef.current) {
      URL.revokeObjectURL(pendingBlobRef.current);
      pendingBlobRef.current = null;
    }
    setEditorOpen(false);
    setEditingId(null);
    setDraft(emptyDraft());
    setFormError(null);
    setSaving(false);
    setUploadLogoError(null);
    setUploadLogoSuccess(false);
    setPendingPresetId(null);
    setLocalLogoPreview(null);
    setLogoPreviewFailed(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormError(null);
    setUploadLogoError(null);
    setUploadLogoSuccess(false);
    setPendingPresetId(null);
    setLocalLogoPreview(null);
    setEditorOpen(true);
  };

  const openEdit = (client: BrandingClient) => {
    setEditingId(client._id);
    setDraft({
      _id: client._id,
      name: client.name,
      customerProductName: client.customerProductName || '',
      providerProductName: client.providerProductName || '',
      logoUrl: client.logoUrl || '',
      themeColors: clonePalette(client.themeColors),
    });
    setFormError(null);
    setUploadLogoError(null);
    setUploadLogoSuccess(false);
    setPendingPresetId(null);
    setLocalLogoPreview(null);
    setEditorOpen(true);
  };

  const setColor = (key: keyof ClientColorPalette, value: string) => {
    setDraft((prev) => ({
      ...prev,
      themeColors: {...prev.themeColors, [key]: value},
    }));
  };

  const onSave = async () => {
    setFormError(null);
    if (!draft.name.trim()) {
      setFormError(t('clientsNameRequired'));
      return;
    }
    for (const key of THEME_COLOR_KEYS) {
      if (!isValidHexColor(draft.themeColors[key])) {
        setFormError(
          t('clientsThemeColorInvalid', {field: COLOR_LABELS[key]}),
        );
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        customerProductName: draft.customerProductName.trim(),
        providerProductName: draft.providerProductName.trim(),
        logoUrl: draft.logoUrl.trim(),
        themeColors: draft.themeColors,
      };
      if (editingId) {
        await updateClient(editingId, payload);
        if (editingId === activeClientId) {
          applyColorPalette(draft.themeColors, {clientId: editingId});
          setRuntimeBranding({
            brandName: draft.name.trim() || undefined,
            logoUrl: draft.logoUrl.trim() || undefined,
          });
        }
      } else {
        await createClient({
          _id: draft._id.trim() || undefined,
          ...payload,
        });
      }
      closeEditor();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const selectedPresetId = useMemo(() => {
    const matched = THEME_PRESETS.find((preset) =>
      palettesEqual(draft.themeColors, preset.palette),
    );
    return matched?.id || 'custom';
  }, [draft.themeColors]);

  const applyPreset = (presetId: string) => {
    const preset = THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setDraft((prev) => ({
      ...prev,
      themeColors: clonePalette(preset.palette),
    }));
    setPendingPresetId(null);
    setFormError(null);
  };

  const onPresetChange = (presetId: string) => {
    if (!presetId || presetId === 'custom') return;
    const preset = THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    if (palettesEqual(draft.themeColors, preset.palette)) return;
    setPendingPresetId(presetId);
  };

  const onUploadLogo = async (file: File | null) => {
    if (!file || !editingId) return;

    // Client-side validation
    setUploadLogoError(null);
    setUploadLogoSuccess(false);
    const normalizedType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (!ALLOWED_LOGO_TYPES.has(normalizedType)) {
      setUploadLogoError(t('logoInvalidType') || 'Logo must be PNG, JPG, JPEG, or WebP.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setUploadLogoError(t('logoTooLarge') || 'Logo must be smaller than 5 MB.');
      return;
    }

    setUploadingLogo(true);
    setLogoPreviewFailed(false);

    // Revoke any previous pending blob
    if (pendingBlobRef.current) {
      URL.revokeObjectURL(pendingBlobRef.current);
      pendingBlobRef.current = null;
    }

    // Show local blob immediately so the user sees their file
    const blobUrl = URL.createObjectURL(file);
    pendingBlobRef.current = blobUrl;
    setLocalLogoPreview(blobUrl);

    try {
      const result = await uploadClientLogo(editingId, file);
      const updatedClient = result.client;
      const nextUrl = result.logoUrl || updatedClient?.logoUrl || '';
      if (!nextUrl) {
        throw new Error(t('errorGeneric'));
      }
      const resolvedServerUrl = resolveLogoSrc(nextUrl);

      setDraft((p) => ({...p, logoUrl: nextUrl}));
      if (editingId === activeClientId) {
        setRuntimeBranding({
          brandName: draft.name.trim() || undefined,
          logoUrl: nextUrl,
        });
      }
      if (updatedClient?._id) {
        setClients((prev) =>
          sortByUpdatedThenCreated(
            prev.map((c) => (c._id === updatedClient._id ? updatedClient : c)),
          ),
        );
      }

      // Preload the server image; only switch preview once it's confirmed loaded.
      // If it fails, keep showing the blob URL so the user still sees their image.
      const serverImg = new Image();
      serverImg.onload = () => {
        if (pendingBlobRef.current) {
          URL.revokeObjectURL(pendingBlobRef.current);
          pendingBlobRef.current = null;
        }
        setLocalLogoPreview(resolvedServerUrl);
        setLogoPreviewFailed(false);
      };
      serverImg.onerror = () => {
        // Server URL not reachable yet — leave the blob preview up
        console.warn('Logo server URL not yet reachable; keeping blob preview.', resolvedServerUrl);
      };
      serverImg.src = resolvedServerUrl;

      setUploadLogoSuccess(true);
      void load();
    } catch (err) {
      // On failure, clear the blob preview and show error
      if (pendingBlobRef.current) {
        URL.revokeObjectURL(pendingBlobRef.current);
        pendingBlobRef.current = null;
      }
      setLocalLogoPreview(null);
      const msg = err instanceof Error ? err.message : t('errorGeneric');
      console.error('Logo upload failed:', msg, err);
      setUploadLogoError(msg || 'Logo upload failed. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const onActivate = async (client: BrandingClient) => {
    setBusyId(client._id);
    setError(null);
    try {
      const branding = await activateClient(client._id);
      setActiveClientId(branding.clientId);
      applyColorPalette(branding.themeColors, {clientId: branding.clientId});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (client: BrandingClient) => {
    if (!window.confirm(t('clientsDeleteConfirm', {name: client.name}))) {
      return;
    }
    setBusyId(client._id);
    setError(null);
    try {
      await deleteClient(client._id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo<VirtualTableColumn<BrandingClient>[]>(
    () => [
      {
        key: 'name',
        header: t('clientsColName'),
        filterable: true,
        filterPlaceholder: t('clientsSearchName'),
        filterValue: (row) => row.name || '',
        render: (row) => (
          <>
            {row.logoUrl ? (
              <img
                className="client-logo-thumb"
                src={resolveLogoSrc(row.logoUrl)}
                alt=""
                width={28}
                height={28}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span
                className="swatch"
                style={{
                  background:
                    row.themeColors?.primary || 'var(--color-primary)',
                }}
              />
            )}
            {row.name}
            {row._id === activeClientId ? (
              <StatusChip
                status="active"
                label={t('clientsActive')}
                style={{marginLeft: 8}}
              />
            ) : null}
          </>
        ),
      },
      {
        key: 'customer',
        header: t('clientsColCustomer'),
        render: (row) => row.customerProductName || row.name || '—',
      },
      {
        key: 'provider',
        header: t('clientsColProvider'),
        render: (row) =>
          row.providerProductName ||
          (row.name ? `${row.name} Provider` : '—'),
      },
      {
        key: 'id',
        header: t('clientsColId'),
        filterable: true,
        filterPlaceholder: t('clientsSearchId'),
        filterValue: (row) => row._id,
        render: (row) => row._id,
      },
      {
        key: 'primary',
        header: t('clientsColPrimary'),
        render: (row) => (
          <code style={{fontSize: '0.85em'}}>{row.themeColors?.primary}</code>
        ),
      },
      {
        key: 'actions',
        header: t('actions'),
        render: (row) => (
          <div className="actions">
            <Button
              variant="ghost"
              disabled={busyId === row._id}
              onClick={() => openEdit(row)}>
              {t('edit')}
            </Button>
            {row._id !== activeClientId ? (
              <Button
                variant="ghost"
                disabled={busyId === row._id}
                onClick={() => void onActivate(row)}>
                {t('clientsSetActive')}
              </Button>
            ) : null}
            {row._id !== activeClientId ? (
              <Button
                variant="danger"
                disabled={busyId === row._id}
                onClick={() => void onDelete(row)}>
                {t('delete')}
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [activeClientId, busyId, t],
  );

  const logoPreview = localLogoPreview || resolveLogoSrc(draft.logoUrl);

  return (
    <div className="admin-page scale-baseline-80" data-testid="clients-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('clientsTitle')}</h1>
          <p>{t('clientsLead')}</p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          {t('clientsAdd')}
        </Button>
      </header>

      <div className="panel">
        {error ? <p className="error-text">{error}</p> : null}
        <VirtualTable
          columns={columns}
          data={clients}
          rowKey={(row) => row._id}
          height={480}
          pageSize={20}
          emptyMessage={t('clientsEmpty')}
          filterDebounceMs={300}
          loading={loading}
          loadingMessage={t('loading')}
        />
      </div>

      {editorOpen ? (
        <Dialog
          open
          title={
            <div className="modal-title-block">
              <div>{`${editingId ? t('clientsEditTitle') : t('clientsAddTitle')} — ${draft.name.trim() || t('clientsUntitled')}`}</div>
              <p>{t('clientsEditLead')}</p>
            </div>
          }
          onClose={closeEditor}
          className="modal--wide"
          testId="clients-editor-modal">
          <div className="modal-section">
            <h4>{t('clientsIdentitySection')}</h4>
            {!editingId ? (
              <label>
                {t('clientsId')}
                <input
                  value={draft._id}
                  onChange={(e) =>
                    setDraft((p) => ({...p, _id: e.target.value}))
                  }
                  placeholder={t('clientsIdPlaceholder')}
                />
              </label>
            ) : (
              <p className="muted compact">
                {t('clientsColId')}: <code>{editingId}</code>
              </p>
            )}

            <label>
              {t('clientsName')}
              <input
                value={draft.name}
                onChange={(e) =>
                  setDraft((p) => ({...p, name: e.target.value}))
                }
                placeholder={t('clientsNamePlaceholder')}
              />
            </label>
          </div>

          <div className="modal-section">
            <h4>{t('clientsAppsSection')}</h4>
            <label>
              {t('clientsCustomerProductName')}
              <input
                value={draft.customerProductName}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    customerProductName: e.target.value,
                  }))
                }
                placeholder={t('clientsCustomerProductPlaceholder')}
              />
            </label>

            <label>
              {t('clientsProviderProductName')}
              <input
                value={draft.providerProductName}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    providerProductName: e.target.value,
                  }))
                }
                placeholder={t('clientsProviderProductPlaceholder')}
              />
            </label>
          </div>

          <div className="modal-section">
            <h4>{t('clientsLogoSection')}</h4>
            <label>
              {t('clientsLogoUrl')}
              <input
                value={draft.logoUrl}
                onChange={(e) => {
                  setLocalLogoPreview(null);
                  setDraft((p) => ({...p, logoUrl: e.target.value}));
                }}
                placeholder={t('clientsLogoUrlPlaceholder')}
              />
            </label>

            <div className="client-logo-row">
              {logoPreview && !logoPreviewFailed ? (
                <img
                  key={logoPreview}
                  className="client-logo-preview"
                  src={logoPreview}
                  alt=""
                  width={64}
                  height={64}
                  onLoad={() => setLogoPreviewFailed(false)}
                  onError={() => {
                    setLogoPreviewFailed(true);
                  }}
                />
              ) : (
                <span className="muted compact">{t('clientsPreviewUnavailable')}</span>
              )}
              {editingId ? (
                <div className="client-logo-upload">
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="visually-hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      e.target.value = '';
                      void onUploadLogo(file);
                    }}
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={uploadingLogo || saving}
                    onClick={() => logoFileRef.current?.click()}>
                    {uploadingLogo
                      ? (t('clientsLogoUploading') || 'Uploading logo…')
                      : (t('clientsLogoUpload') || 'Upload logo')}
                  </Button>
                  {uploadingLogo ? (
                    <span className="muted compact">{t('clientsLogoUploading') || 'Uploading…'}</span>
                  ) : uploadLogoSuccess ? (
                    <span className="success-text compact">✓ {t('clientsLogoUploaded') || 'Logo uploaded'}</span>
                  ) : null}
                  {uploadLogoError ? (
                    <p className="error-text compact">{uploadLogoError}</p>
                  ) : null}
                </div>
              ) : (
                <p className="muted compact">{t('clientsLogoHint')}</p>
              )}
            </div>
          </div>

          <div className="modal-section">
            <div className="theme-section-heading">
              <div>
                <h4>{t('clientsThemeColors')}</h4>
                <p className="muted compact">{t('clientsThemeLead')}</p>
              </div>
              <label className="theme-preset-control">
                <span>{t('clientsThemePreset')}</span>
                <select
                  value={selectedPresetId}
                  onChange={(e) => onPresetChange(e.target.value)}>
                  {THEME_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="custom">{t('clientsThemePresetCustom')}</option>
                </select>
              </label>
            </div>

            <div className="theme-section-stack">
              {THEME_SECTIONS.map((section) => (
                <section key={section.title} className="theme-color-section">
                  <div className="theme-color-section__head">
                    <h5>{section.title}</h5>
                    <p className="muted compact">{section.description}</p>
                  </div>
                  <div className="theme-colors-grid">
                    {section.keys.map((key) => (
                      <label key={key} className="theme-color-field">
                        <span>{COLOR_LABELS[key]}</span>
                        <div className="color-input-row">
                          <input
                            type="color"
                            value={normalizeColorInput(draft.themeColors[key])}
                            onChange={(e) => setColor(key, e.target.value.toUpperCase())}
                          />
                          <input
                            type="text"
                            value={draft.themeColors[key]}
                            onChange={(e) => setColor(key, e.target.value.toUpperCase())}
                            placeholder="#000000"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {formError ? <p className="error-text">{formError}</p> : null}

          <div className="modal-actions">
            <Button variant="ghost" disabled={saving || uploadingLogo} onClick={closeEditor}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={saving || uploadingLogo}
              onClick={() => void onSave()}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {pendingPresetId ? (
        <Dialog
          open
          title={t('clientsThemePresetConfirmTitle')}
          onClose={() => setPendingPresetId(null)}>
          <p className="modal-lead">{t('clientsThemePresetConfirmLead')}</p>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setPendingPresetId(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => applyPreset(pendingPresetId)}>
              {t('clientsThemePresetApply')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
