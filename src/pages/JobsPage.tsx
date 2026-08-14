import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useSearchParams} from 'react-router-dom';
import {
  Icon,
  Select,
  VirtualTable,
  type VirtualTableColumn,
  Button,
  Dialog,
  StatusChip,
} from 'sapvt-ltd-web-packages';
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
import {
  getGeographyMeta,
  type GeographyMetaDistrict,
  type GeographyMetaState,
} from '../services/api/geographyApi';
import {adminSocketService} from '../services/adminSocket';
import {formatPhoneDisplay, localTenDigits} from '../utils/phone';
import {downloadExcelSpreadsheet} from '../utils/excelExport';
import {sortByUpdatedThenCreated} from '../utils/sort';
import {CopyFeedbackButton} from '../components/CopyFeedbackButton';
import {useAuthStore} from '../store/authStore';
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
const ALL_STATES = '__all_states__';
const ALL_DISTRICTS = '__all_districts__';
const EXPORT_PAGE_SIZE = 100;

const STATUS_EDIT_VALUES = [
  'pending',
  'accepted',
  'in-progress',
  'completed',
  'cancelled',
] as const;

const STATUS_FILTER_VALUES = ['unassigned', ...STATUS_EDIT_VALUES] as const;

function jobStatusI18nKey(status: string): string {
  return `jobStatus_${status.replace(/-/g, '_')}`;
}

function phoneCopyDigits(value?: string | null): string {
  const ten = localTenDigits(value);
  return ten.length === 10 ? ten : '';
}

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
  const parts = [
    value.address,
    value.district || value.city,
    value.state,
    value.pincode,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function addressSearchValue(value?: string | JobAddress | null): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return [
    value.address,
    value.district,
    value.city,
    value.state,
    value.pincode,
  ]
    .filter(Boolean)
    .join(' ');
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

export function JobsPage() {
  const {t} = useTranslation();
  const statusEditOptions = useMemo(
    () =>
      STATUS_EDIT_VALUES.map((value) => ({
        value,
        label: t(jobStatusI18nKey(value)),
      })),
    [t],
  );
  const statusFilterOptions = useMemo(
    () =>
      STATUS_FILTER_VALUES.map((value) => ({
        value,
        label: t(jobStatusI18nKey(value)),
      })),
    [t],
  );
  const [searchParams] = useSearchParams();
  const initialFilter = (() => {
    const f = searchParams.get('filter');
    // Legacy deep-link: needs-provider → unassigned (same admin action queue)
    if (f === 'needs-provider') return 'unassigned';
    if (f && (FILTERS as readonly string[]).includes(f)) {
      return f as (typeof FILTERS)[number];
    }
    return 'all';
  })();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(initialFilter);
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
  const [geoStates, setGeoStates] = useState<GeographyMetaState[]>([]);
  const [geoDistricts, setGeoDistricts] = useState<GeographyMetaDistrict[]>(
    [],
  );
  const [filterStateId, setFilterStateId] = useState(ALL_STATES);
  const [filterDistrictId, setFilterDistrictId] = useState(ALL_DISTRICTS);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);

  const selectedState = useMemo(
    () => geoStates.find((s) => s._id === filterStateId) || null,
    [geoStates, filterStateId],
  );
  const districtOptions = useMemo(() => {
    if (filterStateId === ALL_STATES) return geoDistricts;
    return geoDistricts.filter((d) => d.stateId === filterStateId);
  }, [geoDistricts, filterStateId]);
  const selectedDistrict = useMemo(
    () => geoDistricts.find((d) => d._id === filterDistrictId) || null,
    [geoDistricts, filterDistrictId],
  );

  const areaFilters = useMemo(
    () => ({
      stateId: filterStateId !== ALL_STATES ? filterStateId : undefined,
      state:
        filterStateId !== ALL_STATES ? selectedState?.name : undefined,
      districtId:
        filterDistrictId !== ALL_DISTRICTS ? filterDistrictId : undefined,
      district:
        filterDistrictId !== ALL_DISTRICTS
          ? selectedDistrict?.name
          : undefined,
    }),
    [
      filterDistrictId,
      filterStateId,
      selectedDistrict?.name,
      selectedState?.name,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result =
        filter === 'unassigned'
          ? await getJobCardsPage({
              unassigned: true,
              ...areaFilters,
              limit: PAGE_SIZE,
              offset: page * PAGE_SIZE,
            })
          : await getJobCardsPage({
              status: filter === 'all' ? undefined : filter,
              ...areaFilters,
              limit: PAGE_SIZE,
              offset: page * PAGE_SIZE,
            });
      setRows(sortByUpdatedThenCreated(result.items));
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [areaFilters, filter, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return adminSocketService.onNewServiceRequest(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [filter, filterStateId, filterDistrictId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await getGeographyMeta();
        if (cancelled) return;
        setGeoStates(meta.states || []);
        setGeoDistricts(meta.districts || []);
      } catch {
        // geography optional for filters
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const providerPhoneById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) {
      const phone = p.phone || p.phoneNumber;
      if (phone) map.set(p._id, phone);
    }
    return map;
  }, [providers]);

  const resolveProviderPhone = useCallback(
    (row: JobCard): string => {
      if (isJobUnassigned(row)) return '';
      const fromJob = (row.providerPhone || '').trim();
      if (fromJob) return fromJob;
      const id = (row.providerId || '').trim();
      if (!id) return '';
      return providerPhoneById.get(id) || '';
    },
    [providerPhoneById],
  );

  const onExportExcel = useCallback(async () => {
    if (!superAdminElevated) {
      setExportMessage(t('exportSuperAdminOnly'));
      return;
    }
    setExportBusy(true);
    setExportMessage(null);
    try {
      const all: JobCard[] = [];
      let offset = 0;
      let totalCount = Infinity;
      while (all.length < totalCount) {
        const pageResult =
          filter === 'unassigned'
            ? await getJobCardsPage({
                unassigned: true,
                ...areaFilters,
                limit: EXPORT_PAGE_SIZE,
                offset,
              })
            : await getJobCardsPage({
                status: filter === 'all' ? undefined : filter,
                ...areaFilters,
                limit: EXPORT_PAGE_SIZE,
                offset,
              });
        all.push(...pageResult.items);
        totalCount = pageResult.total;
        if (!pageResult.items.length) break;
        offset += EXPORT_PAGE_SIZE;
      }

      const headers = [
        'Job ID',
        'Service',
        'Problem',
        'Status',
        'Needs provider',
        'Customer name',
        'Customer phone',
        'Customer address',
        'Provider name',
        'Provider phone',
        'Provider address',
        'Task PIN',
        'Created',
        'Accepted',
        'Updated',
      ];
      const excelRows = all.map((job) => {
        const unassigned = isJobUnassigned(job);
        const providerPhone = unassigned
          ? ''
          : job.providerPhone ||
            (job.providerId
              ? providerPhoneById.get(job.providerId) || ''
              : '');
        return [
          job._id,
          job.serviceType || '',
          job.problem || '',
          unassigned ? 'unassigned' : job.status || '',
          unassigned && job.needsAdminAssignment ? 'yes' : 'no',
          job.customerName || '',
          phoneCopyDigits(job.customerPhone) || job.customerPhone || '',
          formatAddress(job.customerAddress),
          unassigned ? '' : job.providerName || '',
          unassigned
            ? ''
            : phoneCopyDigits(providerPhone) || providerPhone || '',
          unassigned ? '' : formatAddress(job.providerAddress),
          job.taskPIN || '',
          formatDate(job.createdAt),
          formatDate(job.acceptedAt),
          formatDate(job.updatedAt),
        ];
      });

      const stamp = new Date().toISOString().slice(0, 10);
      downloadExcelSpreadsheet(
        `job-cards-${stamp}`,
        'Job cards',
        headers,
        excelRows,
      );
      setExportMessage(t('exportExcelDone'));
    } catch (err) {
      setExportMessage(
        err instanceof Error ? err.message : t('exportExcelFailed'),
      );
    } finally {
      setExportBusy(false);
    }
  }, [
    areaFilters,
    filter,
    providerPhoneById,
    superAdminElevated,
    t,
  ]);

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
        header: t('service'),
        width: '7rem',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('filterServices'),
        filterValue: (row) => row.serviceType || '',
        render: (row) => (
          <span>
            {row.serviceType || '—'}
            {row.needsAdminAssignment && isJobUnassigned(row) ? (
              <StatusChip
                status="pending"
                label={t('filterNeedsProvider')}
                style={{marginLeft: 6}}
              />
            ) : null}
          </span>
        ),
      },
      {
        key: 'problem',
        header: t('problem'),
        width: '9rem',
        filterable: true,
        filterPlaceholder: t('searchProblem'),
        filterValue: (row) => row.problem || '',
        render: (row) => (
          <span className="table-problem" title={row.problem || undefined}>
            {row.problem || '—'}
          </span>
        ),
      },
      {
        key: 'customer',
        header: t('customer'),
        width: '14rem',
        filterable: true,
        filterPlaceholder: t('searchCustomer'),
        filterValue: (row) =>
          `${row.customerName || ''} ${row.customerPhone || ''} ${addressSearchValue(row.customerAddress)}`,
        render: (row) => {
          const addr = formatAddress(row.customerAddress);
          const rawPhone = (row.customerPhone || '').trim();
          const phone = rawPhone ? formatPhoneDisplay(rawPhone) : '';
          const copyDigits = phoneCopyDigits(rawPhone);
          return (
            <span
              className="party-cell"
              title={[row.customerName, phone, addr].filter(Boolean).join(' · ')}>
              <span className="party-cell-primary">
                {row.customerName || '—'}
              </span>
              {phone && phone !== '—' ? (
                <span className="party-phone-row">
                  <span className="party-cell-meta">{phone}</span>
                  {copyDigits ? (
                    <CopyFeedbackButton
                      text={copyDigits}
                      ariaLabel={t('copyPhone')}
                      title={t('copyPhone')}
                    />
                  ) : null}
                </span>
              ) : null}
              {addr !== '—' ? (
                <span className="party-cell-meta">{addr}</span>
              ) : null}
            </span>
          );
        },
      },
      {
        key: 'provider',
        header: t('provider'),
        width: '14rem',
        filterable: true,
        filterPlaceholder: t('searchProvider'),
        filterValue: (row) =>
          isJobUnassigned(row)
            ? 'unassigned'
            : `${row.providerName || ''} ${resolveProviderPhone(row)} ${addressSearchValue(row.providerAddress)}`,
        render: (row) => {
          if (isJobUnassigned(row)) {
            return (
              <StatusChip status="pending" label={t('unassigned')} />
            );
          }
          const addr = formatAddress(row.providerAddress);
          const rawPhone = resolveProviderPhone(row);
          const phone = rawPhone ? formatPhoneDisplay(rawPhone) : '';
          const copyDigits = phoneCopyDigits(rawPhone);
          return (
            <span
              className="party-cell"
              title={[row.providerName, phone, addr]
                .filter((part) => part && part !== '—')
                .join(' · ')}>
              <span className="party-cell-primary">
                {row.providerName || '—'}
              </span>
              {phone && phone !== '—' ? (
                <span className="party-phone-row">
                  <span className="party-cell-meta">{phone}</span>
                  {copyDigits ? (
                    <CopyFeedbackButton
                      text={copyDigits}
                      ariaLabel={t('copyPhone')}
                      title={t('copyPhone')}
                    />
                  ) : null}
                </span>
              ) : null}
              {addr !== '—' ? (
                <span className="party-cell-meta">{addr}</span>
              ) : null}
            </span>
          );
        },
      },
      {
        key: 'status',
        header: t('status'),
        width: '8rem',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('filterStatuses'),
        filterOptions: statusFilterOptions,
        filterValue: (row) => row.status || 'pending',
        render: (row) => {
          const status = row.status || 'pending';
          return (
            <StatusChip status={status} label={t(jobStatusI18nKey(status))} />
          );
        },
      },
      {
        key: 'pin',
        header: t('taskPin'),
        width: '7.5rem',
        filterable: true,
        filterPlaceholder: t('searchPin'),
        filterValue: (row) => row.taskPIN || '',
        render: (row) => {
          if (!row.taskPIN) return '—';
          const shown = Boolean(revealedTaskPins[row._id]);
          return (
            <span className="pin-cell">
              <span className="pin-cell-value">
                <code>{shown ? row.taskPIN : t('pinMasked')}</code>
              </span>
              <span className="pin-cell-actions">
                <Button variant="ghost" className="icon-only" aria-label={shown ? t('hidePin') : t('revealPin')} title={shown ? t('hidePin') : t('revealPin')} onClick={() =>
                    setRevealedTaskPins((m) => ({
                      ...m,
                      [row._id]: !m[row._id],
                    }))
                  }>
                  <Icon
                    name={shown ? 'visibility_off' : 'visibility'}
                    size={16}
                  />
                </Button>
                {shown ? (
                  <CopyFeedbackButton
                    text={row.taskPIN || ''}
                    ariaLabel={t('copyPin')}
                    title={t('copyPin')}
                  />
                ) : null}
              </span>
            </span>
          );
        },
      },
      {
        key: 'createdAt',
        header: t('createdDate'),
        width: '9rem',
        filterable: true,
        filterPlaceholder: t('searchCreated'),
        filterValue: (row) => formatDateShort(row.createdAt),
        render: (row) => (
          <span className="table-date" title={formatDate(row.createdAt)}>
            {formatDateShort(row.createdAt)}
          </span>
        ),
      },
      {
        key: 'acceptedAt',
        header: t('acceptedDate'),
        width: '9rem',
        filterable: true,
        filterPlaceholder: t('searchAccepted'),
        filterValue: (row) => formatDateShort(row.acceptedAt),
        render: (row) => (
          <span className="table-date" title={formatDate(row.acceptedAt)}>
            {row.acceptedAt ? formatDateShort(row.acceptedAt) : '—'}
          </span>
        ),
      },
      {
        key: 'updatedAt',
        header: t('updatedCol'),
        width: '9rem',
        filterable: true,
        filterPlaceholder: t('searchUpdated'),
        filterValue: (row) => formatDateShort(row.updatedAt),
        render: (row) => (
          <span className="table-date" title={formatDate(row.updatedAt)}>
            {formatDateShort(row.updatedAt)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: t('actions'),
        width: '9rem',
        render: (row) => (
          <Button
            variant="ghost"
            className="table-view-btn"
            onClick={() => void openView(row)}
            aria-label={t('viewUpdate')}>
            <Icon name="visibility" size={18} />
            {t('viewUpdate')}
          </Button>
        ),
      },
    ],
    [revealedTaskPins, resolveProviderPhone, statusFilterOptions, t],
  );

  const comments = viewJob?.comments ?? [];
  const modalUnassigned = viewJob ? isJobUnassigned(viewJob) : false;

  return (
    <div className="admin-page scale-baseline-80" data-testid="jobs-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('jobsTitle')}</h1>
          <p>{t('jobsLead')}</p>
        </div>
        {superAdminElevated ? (
          <div className="row-header-actions">
            <Button variant="primary" disabled={exportBusy || loading} onClick={() => void onExportExcel()}>
              <Icon name="download" size={18} />
              {exportBusy ? t('exportingExcel') : t('exportExcel')}
            </Button>
          </div>
        ) : null}
      </header>
      {exportMessage ? (
        <p
          className={
            exportMessage === t('exportExcelDone')
              ? 'muted compact'
              : 'error-text'
          }>
          {exportMessage}
        </p>
      ) : null}

      <div className="filter-row">
        {FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            className={filter === s ? 'hs-btn hs-btn--primary hs-btn--md' : 'hs-btn hs-btn--ghost hs-btn--md'}
            onClick={() => {
              setPage(0);
              setFilter(s);
            }}>
            {s === 'all'
              ? t('filter_all')
              : s === 'unassigned'
                ? t('filterUnassigned')
                : t(jobStatusI18nKey(s))}
          </button>
        ))}
        <div className="filter-inline" style={{minWidth: '12rem'}}>
          <Select
            options={[
              {value: ALL_STATES, label: t('allStates')},
              ...geoStates.map((s) => ({value: s._id, label: s.name})),
            ]}
            value={filterStateId}
            placeholder={t('filterByState')}
            showSearch
            searchPlaceholder={t('searchState')}
            emptyMessage={t('noStatesFound')}
            onChange={(value) => {
              setFilterStateId(value || ALL_STATES);
              setFilterDistrictId(ALL_DISTRICTS);
              setPage(0);
            }}
          />
        </div>
        <div className="filter-inline" style={{minWidth: '12rem'}}>
          <Select
            options={[
              {value: ALL_DISTRICTS, label: t('allDistricts')},
              ...districtOptions.map((d) => ({
                value: d._id,
                label: d.name,
              })),
            ]}
            value={filterDistrictId}
            placeholder={t('filterByDistrict')}
            showSearch
            searchPlaceholder={t('searchDistrict')}
            emptyMessage={t('noDistrictsFound')}
            disabled={filterStateId === ALL_STATES}
            onChange={(value) => {
              setFilterDistrictId(value || ALL_DISTRICTS);
              setPage(0);
            }}
          />
        </div>
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
        <Dialog open
          title={t('jobDetails')}
          onClose={closeView}
          className="modal--wide"
          testId="job-view-modal">
          {viewLoading ? <p className="muted compact">{t('loading')}</p> : null}
          {viewError ? <p className="error-text">{viewError}</p> : null}

          <dl className="detail-list detail-list--grid">
            <div>
              <dt>
                <Icon name="handyman" size={14} /> {t('service')}
              </dt>
              <dd>{viewJob.serviceType || '—'}</dd>
            </div>
            <div>
              <dt>
                <Icon name="flag" size={14} /> {t('status')}
              </dt>
              <dd>
                <StatusChip
                  status={
                    modalUnassigned
                      ? 'pending'
                      : viewJob.status || 'pending'
                  }
                  label={
                    modalUnassigned
                      ? t('unassigned')
                      : t(jobStatusI18nKey(viewJob.status || 'pending'))
                  }
                />
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
                    <Button variant="ghost" onClick={() => setRevealModalPin((v) => !v)}>
                      {revealModalPin ? t('hidePin') : t('revealPin')}
                    </Button>
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
            <div>
              <dt>
                <Icon name="event" size={14} /> {t('createdDate')}
              </dt>
              <dd>{formatDate(viewJob.createdAt)}</dd>
            </div>
            <div>
              <dt>
                <Icon name="check_circle" size={14} /> {t('acceptedDate')}
              </dt>
              <dd>
                {viewJob.acceptedAt ? formatDate(viewJob.acceptedAt) : '—'}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="update" size={14} /> {t('updatedCol')}
              </dt>
              <dd>{formatDate(viewJob.updatedAt)}</dd>
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
                <StatusChip status="pending" label={t('unassigned')} />
              </p>
            ) : (
              <p className="job-party-name">
                {viewJob.providerName || '—'}
                {(() => {
                  const phone = resolveProviderPhone(viewJob);
                  return phone
                    ? ` · ${formatPhoneDisplay(phone)}`
                    : '';
                })()}
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
                searchPlaceholder={t('searchProvider')}
                emptyMessage={t('empty')}
                onChange={setAssignProviderId}
              />
            </label>
            <div className="actions">
              <Button variant="primary" disabled={ actionBusy || !assignProviderId || (!modalUnassigned && assignProviderId === (viewJob.providerId || '').trim()) } onClick={onAssignOrChange}>
                <Icon name={modalUnassigned ? 'person_add' : 'swap_horiz'} size={16} />
                {actionBusy
                  ? t('saving')
                  : modalUnassigned
                    ? t('assignAndConfirm')
                    : t('changeProvider')}
              </Button>
              {!modalUnassigned ? (
                <Button variant="ghost" disabled={actionBusy} onClick={onUnassign}>
                  <Icon name="person_remove" size={16} />
                  {t('unassignProvider')}
                </Button>
              ) : null}
            </div>
            {!modalUnassigned ? (
              <label>
                {t('updateStatus')}
                <Select
                  options={statusEditOptions}
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
              <Button variant="primary" disabled={commentBusy || !commentText.trim()} onClick={() => void onPostComment()}>
                <Icon name="send" size={16} />
                {commentBusy ? t('postingComment') : t('postComment')}
              </Button>
              <Button variant="ghost" onClick={closeView}>
                {t('cancel')}
              </Button>
            </div>
          </section>
        </Dialog>
      ) : null}
    </div>
  );
}
