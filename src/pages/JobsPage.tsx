import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Icon,
  Select,
  VirtualTable,
  type VirtualTableColumn,
} from 'sapvt-ltd-web-packages';
import {Modal} from '../components/Modal';
import {
  addJobCardComment,
  assignProviderToJobCard,
  getJobCardsPage,
  getJobCardById,
  isJobUnassigned,
  unassignProviderFromJobCard,
  updateJobCard,
  type JobAddress,
  type JobCard,
  type JobComment,
} from '../services/api/jobCardsApi';
import {getProviders, type Provider} from '../services/api/providersApi';
import {formatPhoneDisplay} from '../utils/phone';
import '../styles/pages.css';

const FILTERS = [
  'all',
  'unassigned',
  'pending',
  'accepted',
  'in-progress',
  'completed',
  'cancelled',
] as const;

const PAGE_SIZE = 50;

const STATUS_EDIT_OPTIONS = [
  'pending',
  'accepted',
  'in-progress',
  'completed',
  'cancelled',
].map((s) => ({value: s, label: s}));

const STATUS_FILTER_OPTIONS = [
  'unassigned',
  ...STATUS_EDIT_OPTIONS.map((o) => o.value),
].map((s) => ({value: s, label: s}));

function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function formatDateShort(value?: string | Date | null): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function formatAddress(value?: string | JobAddress | null): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.trim() || '—';
  const parts = [value.address, value.city, value.state, value.pincode].filter(
    Boolean,
  );
  return parts.length ? parts.join(', ') : '—';
}

function providerLabel(p: Provider): string {
  const name = p.businessName || p.name || p.displayName || p._id;
  const service = p.serviceType || p.specialization;
  return service ? `${name} · ${service}` : name;
}

function commentRoleLabel(
  role: JobComment['role'],
  t: (key: string) => string,
): string {
  if (role === 'customer') return t('commentRoleCustomer');
  if (role === 'provider') return t('commentRoleProvider');
  return t('commentRoleAdmin');
}

function commentIcon(role: JobComment['role']): string {
  if (role === 'customer') return 'person';
  if (role === 'provider') return 'engineering';
  return 'admin_panel_settings';
}

function statusBadgeClass(status: string): string {
  if (status === 'completed' || status === 'accepted') return 'badge-approved';
  if (status === 'cancelled') return 'badge-rejected';
  return 'badge-pending';
}

export function JobsPage() {
  const {t} = useTranslation();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [rows, setRows] = useState<JobCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);

  const [viewJob, setViewJob] = useState<JobCard | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [assignProviderId, setAssignProviderId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [revealedTaskPins, setRevealedTaskPins] = useState<
    Record<string, boolean>
  >({});
  const [revealModalPin, setRevealModalPin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result =
        filter === 'unassigned'
          ? await getJobCardsPage({
              unassigned: true,
              limit: PAGE_SIZE,
              offset: page * PAGE_SIZE,
            })
          : await getJobCardsPage({
              status: filter === 'all' ? undefined : filter,
              limit: PAGE_SIZE,
              offset: page * PAGE_SIZE,
            });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [filter, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getProviders({
          approvalStatus: 'approved',
          limit: 100,
        });
        if (!cancelled) setProviders(list);
      } catch {
        /* optional until assign */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const providerOptions = useMemo(
    () =>
      providers.map((p) => ({
        value: p._id,
        label: providerLabel(p),
      })),
    [providers],
  );

  const refreshViewJob = async (jobId: string) => {
    const full = await getJobCardById(jobId);
    if (full) {
      setViewJob(full);
      setAssignProviderId(isJobUnassigned(full) ? '' : full.providerId || '');
    }
  };

  const withModalAction = async (fn: () => Promise<JobCard | void>) => {
    if (!viewJob) return;
    setActionBusy(true);
    setViewError(null);
    try {
      const result = await fn();
      if (result) {
        setViewJob(result);
        setAssignProviderId(
          isJobUnassigned(result) ? '' : result.providerId || '',
        );
      } else {
        await refreshViewJob(viewJob._id);
      }
      await load();
    } catch (err) {
      setViewError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setActionBusy(false);
    }
  };

  const openView = async (job: JobCard) => {
    setViewJob(job);
    setAssignProviderId(isJobUnassigned(job) ? '' : job.providerId || '');
    setCommentText('');
    setViewError(null);
    setViewLoading(true);
    try {
      const full = await getJobCardById(job._id);
      if (full) {
        setViewJob(full);
        setAssignProviderId(
          isJobUnassigned(full) ? '' : full.providerId || '',
        );
      }
    } catch (err) {
      setViewError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    setViewJob(null);
    setAssignProviderId('');
    setCommentText('');
    setViewError(null);
    setRevealModalPin(false);
  };

  const onAssignOrChange = () => {
    if (!viewJob || !assignProviderId) {
      setViewError(t('selectProviderRequired'));
      return;
    }
    const unassigned = isJobUnassigned(viewJob);
    if (!unassigned && assignProviderId === (viewJob.providerId || '').trim()) {
      return;
    }
    void withModalAction(() =>
      assignProviderToJobCard(
        viewJob._id,
        assignProviderId,
        unassigned ? 'accepted' : viewJob.status || 'accepted',
      ),
    );
  };

  const onUnassign = () => {
    if (!viewJob || isJobUnassigned(viewJob)) return;
    if (!window.confirm(t('unassignConfirm'))) return;
    void withModalAction(() => unassignProviderFromJobCard(viewJob._id));
  };

  const onStatusChange = (status: string) => {
    if (!viewJob || !status || status === viewJob.status) return;
    if (status === 'unassigned') {
      onUnassign();
      return;
    }
    void withModalAction(() => updateJobCard(viewJob._id, {status}));
  };

  const onPostComment = async () => {
    if (!viewJob) return;
    const text = commentText.trim();
    if (!text) {
      setViewError(t('commentRequired'));
      return;
    }
    setCommentBusy(true);
    setViewError(null);
    try {
      const updated = await addJobCardComment(viewJob._id, text);
      setViewJob(updated);
      setCommentText('');
      await load();
    } catch (err) {
      setViewError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setCommentBusy(false);
    }
  };

  const columns = useMemo<VirtualTableColumn<JobCard>[]>(
    () => [
      {
        key: 'service',
        header: 'Service',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: 'Filter services',
        filterValue: (row) => row.serviceType || '',
        render: (row) => row.serviceType || '—',
      },
      {
        key: 'problem',
        header: 'Problem',
        filterable: true,
        filterPlaceholder: 'Search problem',
        filterValue: (row) => row.problem || '',
        render: (row) => (
          <span className="table-problem" title={row.problem || undefined}>
            {row.problem || '—'}
          </span>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        filterable: true,
        filterPlaceholder: 'Search customer',
        filterValue: (row) =>
          `${row.customerName || ''} ${row.customerPhone || ''}`,
        render: (row) =>
          row.customerName
            ? `${row.customerName}${
                row.customerPhone
                  ? ` · ${formatPhoneDisplay(row.customerPhone)}`
                  : ''
              }`
            : '—',
      },
      {
        key: 'provider',
        header: 'Provider',
        filterable: true,
        filterPlaceholder: 'Search provider',
        filterValue: (row) =>
          isJobUnassigned(row)
            ? 'unassigned'
            : `${row.providerName || ''} ${row.providerPhone || ''}`,
        render: (row) =>
          isJobUnassigned(row) ? (
            <span className="badge badge-pending">{t('unassigned')}</span>
          ) : row.providerName ? (
            `${row.providerName}${
              row.providerPhone
                ? ` · ${formatPhoneDisplay(row.providerPhone)}`
                : ''
            }`
          ) : (
            '—'
          ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '8rem',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: 'Filter statuses',
        filterOptions: STATUS_FILTER_OPTIONS,
        filterValue: (row) => row.status || 'pending',
        render: (row) => {
          const status = row.status || 'pending';
          return (
            <span className={`badge ${statusBadgeClass(status)}`}>
              {status === 'unassigned' ? t('unassigned') : status}
            </span>
          );
        },
      },
      {
        key: 'pin',
        header: 'Task PIN',
        filterable: true,
        filterPlaceholder: 'Search PIN',
        filterValue: (row) => row.taskPIN || '',
        render: (row) => {
          if (!row.taskPIN) return '—';
          const shown = Boolean(revealedTaskPins[row._id]);
          return (
            <span className="pin-reveal-cell">
              <code>{shown ? row.taskPIN : t('pinMasked')}</code>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setRevealedTaskPins((m) => ({
                    ...m,
                    [row._id]: !m[row._id],
                  }))
                }>
                {shown ? t('hidePin') : t('revealPin')}
              </button>
            </span>
          );
        },
      },
      {
        key: 'createdAt',
        header: 'Created',
        width: '9rem',
        filterable: true,
        filterPlaceholder: 'Search created',
        filterValue: (row) => formatDateShort(row.createdAt),
        render: (row) => (
          <span className="table-date" title={formatDate(row.createdAt)}>
            {formatDateShort(row.createdAt)}
          </span>
        ),
      },
      {
        key: 'updatedAt',
        header: 'Updated',
        width: '9rem',
        filterable: true,
        filterPlaceholder: 'Search updated',
        filterValue: (row) => formatDateShort(row.updatedAt),
        render: (row) => (
          <span className="table-date" title={formatDate(row.updatedAt)}>
            {formatDateShort(row.updatedAt)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: '9rem',
        render: (row) => (
          <button
            type="button"
            className="btn btn-ghost table-view-btn"
            onClick={() => void openView(row)}
            aria-label={t('viewUpdate')}>
            <Icon name="visibility" size={18} />
            {t('viewUpdate')}
          </button>
        ),
      },
    ],
    [revealedTaskPins, t],
  );

  const comments = viewJob?.comments ?? [];
  const modalUnassigned = viewJob ? isJobUnassigned(viewJob) : false;

  return (
    <div className="admin-page scale-baseline-80" data-testid="jobs-root">
      <header className="page-header">
        <h1>{t('jobsTitle')}</h1>
        <p>{t('jobsLead')}</p>
      </header>

      <div className="filter-row">
        {FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            className={filter === s ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setFilter(s)}>
            {s === 'unassigned' ? t('filterUnassigned') : s}
          </button>
        ))}
      </div>

      <div className="panel">
        {error ? <p className="error-text">{error}</p> : null}
        <VirtualTable
          columns={columns}
          data={rows}
          rowKey={(row) => row._id}
          height={480}
          pageSize={PAGE_SIZE}
          emptyMessage={t('empty')}
          filterDebounceMs={300}
          loading={loading}
          loadingMessage={t('loading')}
          serverPagination={{
            total,
            page,
            onPageChange: setPage,
          }}
        />
      </div>

      {viewJob ? (
        <Modal
          title={t('jobDetails')}
          onClose={closeView}
          className="modal--wide"
          testId="job-view-modal">
          {viewLoading ? <p className="muted compact">{t('loading')}</p> : null}
          {viewError ? <p className="error-text">{viewError}</p> : null}

          <dl className="detail-list detail-list--grid">
            <div>
              <dt>
                <Icon name="handyman" size={14} /> Service
              </dt>
              <dd>{viewJob.serviceType || '—'}</dd>
            </div>
            <div>
              <dt>
                <Icon name="flag" size={14} /> Status
              </dt>
              <dd>
                <span
                  className={`badge ${statusBadgeClass(
                    modalUnassigned ? 'unassigned' : viewJob.status || 'pending',
                  )}`}>
                  {modalUnassigned ? t('unassigned') : viewJob.status || '—'}
                </span>
              </dd>
            </div>
            <div className="detail-span-2">
              <dt>
                <Icon name="report" size={14} /> {t('issueProblem')}
              </dt>
              <dd>{viewJob.problem || '—'}</dd>
            </div>
            <div>
              <dt>
                <Icon name="pin" size={14} /> {t('taskPin')}
              </dt>
              <dd>
                {viewJob.taskPIN ? (
                  <span className="pin-reveal-cell">
                    <code>
                      {revealModalPin ? viewJob.taskPIN : t('pinMasked')}
                    </code>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setRevealModalPin((v) => !v)}>
                      {revealModalPin ? t('hidePin') : t('revealPin')}
                    </button>
                  </span>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="schedule" size={14} /> {t('scheduledTime')}
              </dt>
              <dd>{formatDate(viewJob.scheduledTime)}</dd>
            </div>
            {viewJob.cancellationReason ? (
              <div className="detail-span-2">
                <dt>
                  <Icon name="cancel" size={14} /> {t('cancellationReason')}
                </dt>
                <dd>{viewJob.cancellationReason}</dd>
              </div>
            ) : null}
          </dl>

          <section className="job-party">
            <h4 className="modal-section-title">
              <Icon name="person" size={16} /> Customer
            </h4>
            <p className="job-party-name">
              {viewJob.customerName || '—'}
              {viewJob.customerPhone
                ? ` · ${formatPhoneDisplay(viewJob.customerPhone)}`
                : ''}
            </p>
            <p className="job-party-address">
              <Icon name="location_on" size={16} />
              <span>
                <span className="job-party-label">{t('customerAddress')}</span>
                {formatAddress(viewJob.customerAddress)}
              </span>
            </p>
          </section>

          <section className="job-party">
            <h4 className="modal-section-title">
              <Icon name="engineering" size={16} /> Provider
            </h4>
            {modalUnassigned ? (
              <p className="job-party-name">
                <span className="badge badge-pending">{t('unassigned')}</span>
              </p>
            ) : (
              <p className="job-party-name">
                {viewJob.providerName || '—'}
                {viewJob.providerPhone
                  ? ` · ${formatPhoneDisplay(viewJob.providerPhone)}`
                  : ''}
              </p>
            )}
            <p className="job-party-address">
              <Icon name="location_on" size={16} />
              <span>
                <span className="job-party-label">{t('providerAddress')}</span>
                {formatAddress(viewJob.providerAddress)}
              </span>
            </p>
          </section>

          <section className="assign-block">
            <h4 className="modal-section-title">
              <Icon name="tune" size={16} /> {t('updateStatus')}
            </h4>
            <label>
              {modalUnassigned ? t('assignProvider') : t('changeProvider')}
              <Select
                options={providerOptions}
                value={assignProviderId}
                placeholder={t('selectProvider')}
                disabled={actionBusy}
                showSearch
                onChange={setAssignProviderId}
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  actionBusy ||
                  !assignProviderId ||
                  (!modalUnassigned &&
                    assignProviderId === (viewJob.providerId || '').trim())
                }
                onClick={onAssignOrChange}>
                <Icon name={modalUnassigned ? 'person_add' : 'swap_horiz'} size={16} />
                {actionBusy
                  ? t('saving')
                  : modalUnassigned
                    ? t('assignAndConfirm')
                    : t('changeProvider')}
              </button>
              {!modalUnassigned ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={actionBusy}
                  onClick={onUnassign}>
                  <Icon name="person_remove" size={16} />
                  {t('unassignProvider')}
                </button>
              ) : null}
            </div>
            {!modalUnassigned ? (
              <label>
                {t('updateStatus')}
                <Select
                  options={STATUS_EDIT_OPTIONS}
                  value={viewJob.status || 'pending'}
                  disabled={actionBusy}
                  onChange={onStatusChange}
                />
              </label>
            ) : null}
          </section>

          <section className="job-comments">
            <h4 className="modal-section-title">
              <Icon name="chat" size={16} /> {t('jobComments')}
            </h4>
            {comments.length === 0 ? (
              <p className="muted compact">{t('noComments')}</p>
            ) : (
              <ul className="job-comment-list">
                {comments.map((c) => (
                  <li
                    key={c._id}
                    className={`job-comment job-comment--${c.role}`}>
                    <div className="job-comment-meta">
                      <Icon name={commentIcon(c.role)} size={16} />
                      <span className="job-comment-role">
                        {commentRoleLabel(c.role, t)}
                      </span>
                      {c.authorName ? (
                        <span className="job-comment-author">
                          {c.authorName}
                        </span>
                      ) : null}
                      <span className="job-comment-time">
                        {formatDateShort(c.createdAt)}
                      </span>
                    </div>
                    <p className="job-comment-text">{c.text}</p>
                  </li>
                ))}
              </ul>
            )}

            <label>
              {t('addComment')}
              <textarea
                rows={3}
                value={commentText}
                placeholder={t('commentPlaceholder')}
                disabled={commentBusy}
                onChange={(e) => setCommentText(e.target.value)}
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={commentBusy || !commentText.trim()}
                onClick={() => void onPostComment()}>
                <Icon name="send" size={16} />
                {commentBusy ? t('postingComment') : t('postComment')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeView}>
                {t('cancel')}
              </button>
            </div>
          </section>
        </Modal>
      ) : null}
    </div>
  );
}
