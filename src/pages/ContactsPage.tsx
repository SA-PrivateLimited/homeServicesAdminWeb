import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Select,
  VirtualTable,
  type VirtualTableColumn,
  Button,
  Dialog,
  StatusChip,
} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {
  getAllContactRecommendations,
  updateContactRecommendation,
  type ContactRecommendation,
} from '../services/api/contactRecommendationsApi';
import {getServiceCategories} from '../services/api/serviceCategoriesApi';
import {
  formatPhoneDisplay,
  localTenDigits,
  phoneSearchValue,
  toE164,
} from '../utils/phone';
import {formatLastUpdated} from '../utils/datetime';
import {sortByUpdatedThenCreated} from '../utils/sort';
import '../styles/pages.css';

type Status = ContactRecommendation['status'] | 'all';

const STATUS_VALUES = ['pending', 'contacted', 'registered', 'rejected'] as const;

export function ContactsPage() {
  const {t} = useTranslation();
  const statusOptions = useMemo(
    () =>
      STATUS_VALUES.map((value) => ({
        value,
        label: t(`contact_${value}`),
      })),
    [t],
  );
  const [filter, setFilter] = useState<Status>('pending');
  const [rows, setRows] = useState<ContactRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);

  const [editRow, setEditRow] = useState<ContactRecommendation | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editService, setEditService] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editStatus, setEditStatus] =
    useState<ContactRecommendation['status']>('pending');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serviceOptions, setServiceOptions] = useState<
    {value: string; label: string}[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        sortByUpdatedThenCreated(
          await getAllContactRecommendations(
            filter === 'all' ? undefined : {status: filter},
          ),
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

  useEffect(() => {
    void getServiceCategories(false)
      .then((cats) =>
        setServiceOptions(
          cats
            .filter((c) => c.isActive !== false)
            .map((c) => ({value: c.name, label: c.name})),
        ),
      )
      .catch(() => setServiceOptions([]));
  }, []);

  useEffect(() => {
    if (!successBanner) return;
    const timer = window.setTimeout(() => setSuccessBanner(null), 10000);
    return () => window.clearTimeout(timer);
  }, [successBanner]);

  const openEdit = (row: ContactRecommendation) => {
    setEditRow(row);
    setEditName(row.recommendedProviderName || '');
    setEditPhone(localTenDigits(row.recommendedProviderPhone));
    setEditService(row.serviceType || '');
    setEditAddress(row.address || '');
    setEditStatus(row.status);
    setEditNotes(row.adminNotes || '');
    setEditError(null);
  };

  const closeEdit = () => {
    setEditRow(null);
    setEditError(null);
    setSaving(false);
  };

  const onSaveDetails = async () => {
    if (!editRow) return;
    const ten = localTenDigits(editPhone);
    if (!editName.trim()) {
      setEditError(t('nameRequired'));
      return;
    }
    if (ten.length !== 10) {
      setEditError(t('phoneTenDigits'));
      return;
    }
    if (!editService.trim()) {
      setEditError(t('serviceRequired'));
      return;
    }
    setSaving(true);
    setBusyId(editRow._id);
    setEditError(null);
    try {
      await updateContactRecommendation(editRow._id, {
        recommendedProviderName: editName.trim(),
        recommendedProviderPhone: toE164(ten),
        serviceType: editService.trim(),
        address: editAddress.trim() || '',
        status: editStatus,
        adminNotes: editNotes.trim() || '',
      });
      closeEdit();
      setSuccessBanner({
        title: t('contactUpdatedTitle'),
        detail: t('contactUpdatedDetail', {name: editName.trim()}),
      });
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
      setBusyId(null);
    }
  };

  const categoryOptions = useMemo(() => {
    if (editService && !serviceOptions.some((o) => o.value === editService)) {
      return [{value: editService, label: editService}, ...serviceOptions];
    }
    return serviceOptions;
  }, [editService, serviceOptions]);

  const columns = useMemo<VirtualTableColumn<ContactRecommendation>[]>(
    () => [
      {
        key: 'provider',
        header: t('provider'),
        filterable: true,
        filterPlaceholder: t('searchProvider'),
        filterValue: (row) => row.recommendedProviderName || '',
        render: (row) => row.recommendedProviderName,
      },
      {
        key: 'phone',
        header: t('phone'),
        filterable: true,
        filterPlaceholder: t('searchPhone'),
        filterValue: (row) =>
          phoneSearchValue(row.recommendedProviderPhone),
        render: (row) => formatPhoneDisplay(row.recommendedProviderPhone),
      },
      {
        key: 'location',
        header: t('locationAddress'),
        filterable: true,
        filterPlaceholder: t('searchLocation'),
        filterValue: (row) => row.address || '',
        render: (row) => row.address || '—',
      },
      {
        key: 'service',
        header: t('service'),
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('filterServices'),
        filterValue: (row) => row.serviceType || '',
        render: (row) => row.serviceType,
      },
      {
        key: 'from',
        header: t('sharedBy'),
        filterable: true,
        filterPlaceholder: t('searchSharer'),
        filterValue: (row) =>
          `${row.recommendedByName || ''} ${row.recommendedByPhone || ''} ${row.recommendedByRole || ''}`,
        render: (row) => (
          <span className="shared-by-cell">
            <span>
              {row.recommendedByName || '—'}{' '}
              <span className="muted">({row.recommendedByRole})</span>
            </span>
            <span className="muted compact">
              {formatPhoneDisplay(row.recommendedByPhone)}
            </span>
          </span>
        ),
      },
      {
        key: 'status',
        header: t('status'),
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('filterStatuses'),
        filterOptions: statusOptions,
        filterValue: (row) => row.status || '',
        render: (row) => {
          const status = row.status || 'pending';
          return (
            <StatusChip status={status} label={t(`contact_${status}`)} />
          );
        },
      },
      {
        key: 'updatedAt',
        header: t('lastUpdated'),
        width: '10rem',
        render: (row) => formatLastUpdated(row.updatedAt || row.createdAt),
      },
      {
        key: 'actions',
        header: t('actions'),
        width: '9rem',
        render: (row) => (
          <Button variant="ghost" disabled={busyId === row._id} onClick={() => openEdit(row)}>
            {t('updateDetails')}
          </Button>
        ),
      },
    ],
    [busyId, statusOptions, t],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="contacts-root">
      <header className="page-header">
        <h1>{t('contactsTitle')}</h1>
        <p>{t('contactsLead')}</p>
      </header>

      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="contacts-success-banner"
        />
      ) : null}

      <div className="filter-row">
        {(
          ['pending', 'contacted', 'registered', 'rejected', 'all'] as Status[]
        ).map((f) => (
          <button
            key={f}
            type="button"
            className={
              filter === f
                ? 'hs-btn hs-btn--primary hs-btn--md'
                : 'hs-btn hs-btn--ghost hs-btn--md'
            }
            onClick={() => setFilter(f)}>
            {t(`contact_${f}`)}
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
          pageSize={20}
          emptyMessage={t('empty')}
          filterDebounceMs={300}
          loading={loading}
          loadingMessage={t('loading')}
        />
      </div>

      {editRow ? (
        <Dialog open
          title={t('updateContactTitle')}
          onClose={closeEdit}
          testId="contacts-edit-modal">
          <p className="muted compact">{t('updateContactLead')}</p>
          <label>
            {t('name')}
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </label>
          <label>
            {t('phone')}
            <div className="phone-input-row">
              <span className="phone-prefix" aria-hidden>
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={editPhone}
                placeholder={t('phoneTenDigitsHint')}
                onChange={(e) =>
                  setEditPhone(localTenDigits(e.target.value).slice(0, 10))
                }
              />
            </div>
          </label>
          <label>
            {t('locationAddress')}
            <input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder={t('addressPlaceholder')}
            />
          </label>
          <label>
            {t('serviceType')}
            <Select
              options={categoryOptions}
              value={editService}
              placeholder={t('selectServiceType')}
              showSearch
              searchPlaceholder={t('searchProfession')}
              emptyMessage={t('empty')}
              onChange={setEditService}
            />
          </label>
          <Select
            label={t('status')}
            options={statusOptions}
            value={editStatus}
            onChange={(value) =>
              setEditStatus(value as ContactRecommendation['status'])
            }
          />
          <label>
            {t('adminNotes')}
            <textarea
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </label>
          {editError ? <p className="error-text">{editError}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={saving} onClick={() => void onSaveDetails()}>
              {saving ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={closeEdit}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
