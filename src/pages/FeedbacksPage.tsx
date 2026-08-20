import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Button,
  Dialog,
  Select,
  StatusChip,
  VirtualTable,
  type VirtualTableColumn,
} from 'sapvt-ltd-web-packages';
import {
  listFeedback,
  updateFeedback,
  type FeedbackStatus,
  type UserFeedback,
} from '../services/api/feedbackApi';
import {formatPhoneDisplay} from '../utils/phone';
import {formatLastUpdated} from '../utils/datetime';
import {sortByUpdatedThenCreated} from '../utils/sort';
import '../styles/pages.css';

const STATUS_VALUES = ['new', 'read', 'resolved', 'archived'] as const;

export function FeedbacksPage() {
  const {t} = useTranslation();
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('new');
  const [rows, setRows] = useState<UserFeedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detail, setDetail] = useState<UserFeedback | null>(null);
  const [editStatus, setEditStatus] = useState<FeedbackStatus>('new');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        sortByUpdatedThenCreated(
          await listFeedback({status: filter === 'all' ? undefined : filter}),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = (row: UserFeedback) => {
    setDetail(row);
    setEditStatus(row.status);
    setEditNotes(row.adminNotes || '');
    setEditError(null);
  };

  const onSave = async () => {
    if (!detail) return;
    setSaving(true);
    setEditError(null);
    try {
      const updated = await updateFeedback(detail._id, {
        status: editStatus,
        adminNotes: editNotes,
      });
      setRows((prev) =>
        prev.map((r) => (r._id === updated._id ? {...r, ...updated} : r)),
      );
      setDetail(null);
      void load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (row: UserFeedback, status: FeedbackStatus) => {
    setBusyId(row._id);
    try {
      await updateFeedback(row._id, {status});
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const columns: VirtualTableColumn<UserFeedback>[] = [
    {
      key: 'created',
      header: t('feedbackColWhen'),
      width: 140,
      filterValue: (row) => row.createdAt || '',
      render: (row) => formatLastUpdated(row.createdAt),
    },
    {
      key: 'message',
      header: t('feedbackColMessage'),
      width: 320,
      filterValue: (row) => row.message || '',
      render: (row) => (
        <button
          type="button"
          className="linkish"
          onClick={() => openDetail(row)}>
          {row.message.length > 80
            ? `${row.message.slice(0, 80)}…`
            : row.message}
        </button>
      ),
    },
    {
      key: 'phone',
      header: t('feedbackColPhone'),
      width: 130,
      filterValue: (row) => row.phone || '',
      render: (row) => (row.phone ? formatPhoneDisplay(row.phone) : '—'),
    },
    {
      key: 'app',
      header: t('feedbackColApp'),
      width: 100,
      filterValue: (row) => row.app || '',
      render: (row) => row.app || '—',
    },
    {
      key: 'source',
      header: t('feedbackColSource'),
      width: 120,
      filterValue: (row) => row.source || '',
      render: (row) => row.source || '—',
    },
    {
      key: 'status',
      header: t('feedbackColStatus'),
      width: 110,
      filterValue: (row) => row.status,
      render: (row) => (
        <StatusChip
          status={row.status === 'new' ? 'pending' : 'active'}
          label={t(`feedback_${row.status}`)}
        />
      ),
    },
    {
      key: 'actions',
      header: t('feedbackColActions'),
      width: 200,
      render: (row) => (
        <div className="row-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={busyId === row._id}
            onClick={() => openDetail(row)}>
            {t('feedbackOpen')}
          </Button>
          {row.status === 'new' ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busyId === row._id}
              onClick={() => void quickStatus(row, 'read')}>
              {t('feedbackMarkRead')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="admin-page scale-baseline-80" data-testid="feedbacks-root">
      <header className="page-header">
        <h1>{t('feedbackTitle')}</h1>
        <p>{t('feedbackLead')}</p>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="filter-row">
        {(['new', 'read', 'resolved', 'archived', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={
              filter === f
                ? 'hs-btn hs-btn--primary hs-btn--md'
                : 'hs-btn hs-btn--ghost hs-btn--md'
            }
            onClick={() => setFilter(f)}>
            {f === 'all' ? t('feedbackFilterAll') : t(`feedback_${f}`)}
          </button>
        ))}
        <Button type="button" variant="secondary" onClick={() => void load()}>
          {t('reload')}
        </Button>
      </div>

      <VirtualTable
        rows={rows}
        columns={columns}
        loading={loading}
        rowKey={(row) => row._id}
        emptyMessage={t('feedbackEmpty')}
      />

      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={t('feedbackDetailTitle')}
        footer={
          <div className="dialog-actions">
            <Button type="button" variant="ghost" onClick={() => setDetail(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={saving}
              onClick={() => void onSave()}>
              {t('save')}
            </Button>
          </div>
        }>
        {detail ? (
          <div className="feedback-detail">
            <p className="feedback-detail__message">{detail.message}</p>
            <p className="muted">
              {t('feedbackColPhone')}:{' '}
              {detail.phone ? formatPhoneDisplay(detail.phone) : '—'}
            </p>
            <p className="muted">
              {t('feedbackColApp')}: {detail.app || '—'} · {detail.source || '—'}
            </p>
            <p className="muted">
              {t('feedbackColWhen')}: {formatLastUpdated(detail.createdAt)}
            </p>
            <Select
              label={t('feedbackColStatus')}
              value={editStatus}
              options={STATUS_VALUES.map((value) => ({
                value,
                label: t(`feedback_${value}`),
              }))}
              onChange={(v) => setEditStatus(v as FeedbackStatus)}
            />
            <label className="field-label" htmlFor="feedback-notes">
              {t('feedbackNotes')}
            </label>
            <textarea
              id="feedback-notes"
              className="admin-textarea"
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
            {editError ? <p className="error-text">{editError}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
