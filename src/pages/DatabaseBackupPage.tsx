import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Dialog} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {
  RESTORE_CONFIRM_PHRASE,
  downloadDatabaseBackup,
  getBackupSummary,
  restoreDatabaseBackup,
  type BackupSummary,
} from '../services/api/backupApi';
import {ApiError} from '../services/api/apiClient';
import '../styles/pages.css';
import './DatabaseBackupPage.css';

function eventWho(event: {
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminId: string;
}): string {
  return (
    event.adminName ||
    event.adminEmail ||
    event.adminPhone ||
    event.adminId ||
    'Admin'
  );
}

function eventWhen(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at || '';
  return date.toLocaleString();
}

export function DatabaseBackupPage() {
  const {t} = useTranslation();
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getBackupSummary();
      setSummary(next);
      setSelected((prev) => {
        const names = next.collections.map((c) => c.name);
        const kept = prev.filter((name) => names.includes(name));
        return kept.length ? kept : names;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const allNames = useMemo(
    () => summary?.collections.map((c) => c.name) || [],
    [summary],
  );
  const allSelected =
    allNames.length > 0 && selected.length === allNames.length;

  const toggleOne = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : allNames);
  };

  const runDownload = async (collections?: string[]) => {
    if (collections && !collections.length) {
      setError(t('backupSelectRequired'));
      return;
    }
    setDownloading(collections?.join(',') || 'all');
    setError(null);
    try {
      await downloadDatabaseBackup(collections);
      setSuccessBanner({
        title: t('backupDownloadStartedTitle'),
        detail:
          collections && collections.length === 1
            ? t('backupCollectionDownloaded', {name: collections[0]})
            : collections?.length
              ? t('backupCollectionsDownloaded', {count: collections.length})
              : t('backupDownloadStartedDetail'),
      });
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setDownloading(null);
    }
  };

  const onRestore = async () => {
    if (!file) {
      setError(t('backupFileRequired'));
      return;
    }
    if (confirm.trim() !== RESTORE_CONFIRM_PHRASE) {
      setError(t('backupConfirmMismatch'));
      return;
    }
    if (!selected.length) {
      setError(t('backupSelectRequired'));
      return;
    }
    setRestoring(true);
    setError(null);
    try {
      const onlySelected = !allSelected;
      const result = await restoreDatabaseBackup(
        file,
        confirm.trim(),
        onlySelected ? selected : undefined,
      );
      setRestoreOpen(false);
      setFile(null);
      setConfirm('');
      setSuccessBanner({
        title: t('backupRestoreTitle'),
        detail: t('backupRestoreDetail', {
          count: result.restoredCollections,
        }),
      });
      await loadSummary();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t('errorGeneric');
      setError(message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      className="admin-page scale-baseline-80 backup-admin-page"
      data-testid="database-backup-page">
      <header className="page-header">
        <h1>{t('backupTitle')}</h1>
        <p>{t('backupLead')}</p>
      </header>

      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel backup-admin-panel backup-admin-panel-wide">
        <div className="backup-admin-panel-head">
          <h2>{t('backupDownloadHeading')}</h2>
          <p>{t('backupDownloadLead')}</p>
        </div>
        {loading ? (
          <p>{t('loading')}</p>
        ) : summary ? (
          <p className="backup-admin-stats">
            {t('backupStats', {
              db: summary.database,
              collections: summary.collectionCount,
              documents: summary.documentCount,
            })}
          </p>
        ) : null}
        <div className="backup-admin-actions">
          <Button
            variant="primary"
            disabled={Boolean(downloading) || loading}
            onClick={() => void runDownload()}>
            {downloading === 'all'
              ? t('backupDownloading')
              : t('backupDownload')}
          </Button>
          <Button
            variant="ghost"
            disabled={Boolean(downloading) || loading || !selected.length}
            onClick={() => void runDownload(selected)}>
            {downloading && downloading !== 'all'
              ? t('backupDownloading')
              : t('backupDownloadSelected', {count: selected.length})}
          </Button>
          <Button
            variant="ghost"
            disabled={loading}
            onClick={() => void loadSummary()}>
            {t('reload')}
          </Button>
        </div>
        <p className="backup-admin-hint">{t('backupCollectionsHint')}</p>
        {summary?.collections.length ? (
          <div className="backup-admin-table-wrap">
            <table className="backup-admin-table">
              <thead>
                <tr>
                  <th>
                    <label className="backup-admin-check">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                      {t('backupColName')}
                    </label>
                  </th>
                  <th>{t('backupColRecords')}</th>
                  <th>{t('backupColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.collections.map((row) => (
                  <tr key={row.name}>
                    <td>
                      <label className="backup-admin-check">
                        <input
                          type="checkbox"
                          checked={selected.includes(row.name)}
                          onChange={() => toggleOne(row.name)}
                        />
                        {row.name}
                      </label>
                    </td>
                    <td>{row.documentCount}</td>
                    <td>
                      <Button
                        variant="ghost"
                        disabled={Boolean(downloading) || loading}
                        onClick={() => void runDownload([row.name])}>
                        {downloading === row.name
                          ? t('backupDownloading')
                          : t('backupDownloadOne')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="backup-admin-hint">{t('backupDownloadHint')}</p>
      </section>

      <section className="panel backup-admin-panel backup-admin-panel-wide">
        <div className="backup-admin-panel-head">
          <h2>{t('backupRestoreHeading')}</h2>
          <p>{t('backupRestoreLead')}</p>
        </div>
        <div className="form-row">
          <label htmlFor="backup-file">{t('backupFileLabel')}</label>
          <input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        {file ? (
          <p className="backup-admin-hint">
            {t('backupFileChosen', {name: file.name})}
          </p>
        ) : null}
        <p className="backup-admin-hint">{t('backupRestoreSelectedHint')}</p>
        <Button
          variant="primary"
          disabled={!file || restoring || !selected.length}
          onClick={() => {
            setError(null);
            setRestoreOpen(true);
          }}>
          {allSelected
            ? t('backupRestoreOpen')
            : t('backupUpdateSelected', {count: selected.length})}
        </Button>
      </section>

      <section className="panel backup-admin-panel backup-admin-panel-wide">
        <div className="backup-admin-panel-head">
          <h2>{t('backupActivityHeading')}</h2>
          <p>{t('backupActivityLead')}</p>
        </div>
        {summary?.events?.length ? (
          <div className="backup-admin-table-wrap">
            <table className="backup-admin-table">
              <thead>
                <tr>
                  <th>{t('backupActivityWhen')}</th>
                  <th>{t('backupActivityWho')}</th>
                  <th>{t('backupActivityAction')}</th>
                  <th>{t('backupActivityScope')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.events.map((event) => (
                  <tr key={event.id}>
                    <td>{eventWhen(event.at)}</td>
                    <td>
                      <span className="backup-admin-who">
                        {eventWho(event)}
                      </span>
                      {event.adminEmail && event.adminEmail !== eventWho(event) ? (
                        <span className="backup-admin-hint">
                          {event.adminEmail}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {event.type === 'restore'
                        ? t('backupActivityUpdate')
                        : t('backupActivityDownload')}
                    </td>
                    <td>
                      {event.collections.length
                        ? event.collections.length <= 4
                          ? event.collections.join(', ')
                          : t('backupActivityMany', {
                              count: event.collections.length,
                            })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="backup-admin-hint">{t('backupActivityEmpty')}</p>
        )}
      </section>

      {restoreOpen ? (
        <Dialog
          open
          onClose={() => !restoring && setRestoreOpen(false)}
          title={
            allSelected
              ? t('backupRestoreConfirmTitle')
              : t('backupUpdateConfirmTitle')
          }
          testId="backup-restore-modal">
          <p className="modal-lead">
            {allSelected
              ? t('backupRestoreConfirmLead')
              : t('backupUpdateConfirmLead', {
                  names: selected.join(', '),
                })}
          </p>
          <div className="form-row">
            <label htmlFor="backup-confirm">{t('backupConfirmLabel')}</label>
            <input
              id="backup-confirm"
              value={confirm}
              autoComplete="off"
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={RESTORE_CONFIRM_PHRASE}
            />
          </div>
          <div className="form-actions">
            <Button
              variant="ghost"
              disabled={restoring}
              onClick={() => setRestoreOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={restoring || confirm.trim() !== RESTORE_CONFIRM_PHRASE}
              onClick={() => void onRestore()}>
              {restoring
                ? t('backupRestoring')
                : allSelected
                  ? t('backupRestoreConfirm')
                  : t('backupUpdateConfirm')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
