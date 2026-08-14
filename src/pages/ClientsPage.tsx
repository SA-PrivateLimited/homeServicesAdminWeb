import {useCallback, useEffect, useMemo, useState} from 'react';
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
import {getRuntimeConfig} from '../config/runtime';
import {sortByUpdatedThenCreated} from '../utils/sort';
import '../styles/pages.css';

const THEME_COLOR_KEYS = Object.keys(
  themeConfig.homeservices,
) as Array<keyof ClientColorPalette>;

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

function resolveLogoSrc(logoUrl?: string): string {
  const raw = (logoUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const base = getRuntimeConfig().apiBaseUrl.replace(/\/$/, '');
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
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

  if (!superAdminElevated) {
    return <Navigate to="/" replace />;
  }

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setDraft(emptyDraft());
    setFormError(null);
    setSaving(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormError(null);
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

  const onUploadLogo = async (file: File | null) => {
    if (!file || !editingId) return;
    setUploadingLogo(true);
    setFormError(null);
    try {
      const result = await uploadClientLogo(editingId, file);
      setDraft((p) => ({...p, logoUrl: result.logoUrl}));
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errorGeneric'));
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

  const logoPreview = resolveLogoSrc(draft.logoUrl);

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
          title={editingId ? t('clientsEditTitle') : t('clientsAddTitle')}
          onClose={closeEditor}
          className="modal-wide"
          testId="clients-editor-modal">
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

          <label>
            {t('clientsLogoUrl')}
            <input
              value={draft.logoUrl}
              onChange={(e) =>
                setDraft((p) => ({...p, logoUrl: e.target.value}))
              }
              placeholder={t('clientsLogoUrlPlaceholder')}
            />
          </label>

          <div className="client-logo-row">
            {logoPreview ? (
              <img
                className="client-logo-preview"
                src={logoPreview}
                alt=""
                width={64}
                height={64}
              />
            ) : null}
            {editingId ? (
              <label className="client-logo-upload">
                <Button
                  variant="secondary"
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() =>
                    document.getElementById('client-logo-file')?.click()
                  }>
                  {uploadingLogo ? t('saving') : t('clientsLogoUpload')}
                </Button>
                <input
                  id="client-logo-file"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    e.target.value = '';
                    void onUploadLogo(file);
                  }}
                />
              </label>
            ) : (
              <p className="muted compact">{t('clientsLogoHint')}</p>
            )}
          </div>

          <fieldset className="theme-colors-fieldset">
            <legend>{t('clientsThemeColors')}</legend>
            <div className="theme-colors-grid">
              {THEME_COLOR_KEYS.map((key) => (
                <label key={key} className="theme-color-field">
                  {COLOR_LABELS[key]}
                  <div className="color-input-row">
                    <input
                      type="color"
                      value={normalizeColorInput(draft.themeColors[key])}
                      onChange={(e) => setColor(key, e.target.value)}
                    />
                    <input
                      type="text"
                      value={draft.themeColors[key]}
                      onChange={(e) => setColor(key, e.target.value)}
                    />
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {formError ? <p className="error-text">{formError}</p> : null}

          <div className="actions">
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void onSave()}>
              {saving ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={closeEditor}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
