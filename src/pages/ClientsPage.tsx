import {useCallback, useEffect, useMemo, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {VirtualTable, type VirtualTableColumn} from 'sapvt-ltd-web-packages';
import {Modal} from '../components/Modal';
import {
  activateClient,
  createClient,
  deleteClient,
  getClients,
  updateClient,
  type BrandingClient,
  type ClientColorPalette,
} from '../services/api/clientsApi';
import {useAuthStore} from '../store/authStore';
import {applyColorPalette} from '../theme';
import {themeConfig} from '../theme/themeConfig';
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

function emptyDraft(): {
  _id: string;
  name: string;
  themeColors: ClientColorPalette;
} {
  return {
    _id: '',
    name: '',
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClients();
      setClients(data.clients);
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
      if (editingId) {
        await updateClient(editingId, {
          name: draft.name.trim(),
          themeColors: draft.themeColors,
        });
        if (editingId === activeClientId) {
          applyColorPalette(draft.themeColors, {clientId: editingId});
        }
      } else {
        await createClient({
          _id: draft._id.trim() || undefined,
          name: draft.name.trim(),
          themeColors: draft.themeColors,
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
            <span
              className="swatch"
              style={{
                background:
                  row.themeColors?.primary || 'var(--color-primary)',
              }}
            />
            {row.name}
            {row._id === activeClientId ? (
              <span className="badge badge-approved" style={{marginLeft: 8}}>
                {t('clientsActive')}
              </span>
            ) : null}
          </>
        ),
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
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busyId === row._id}
              onClick={() => openEdit(row)}>
              {t('edit')}
            </button>
            {row._id !== activeClientId ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyId === row._id}
                onClick={() => void onActivate(row)}>
                {t('clientsSetActive')}
              </button>
            ) : null}
            {row._id !== activeClientId ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busyId === row._id}
                onClick={() => void onDelete(row)}>
                {t('delete')}
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [activeClientId, busyId, t],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="clients-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('clientsTitle')}</h1>
          <p>{t('clientsLead')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          {t('clientsAdd')}
        </button>
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
        <Modal
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
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => void onSave()}>
              {saving ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={saving}
              onClick={closeEditor}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
