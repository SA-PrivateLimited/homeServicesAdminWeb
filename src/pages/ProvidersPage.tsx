import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
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
  SuccessBanner,
  pinSuccessBanner,
  userLabel,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {
  getProvidersPage,
  updateProvider,
  updateProviderApproval,
  type Provider,
} from '../services/api/providersApi';
import {
  getAreaProviderDemands,
  updateAreaProviderDemand,
  type AreaProviderDemand,
} from '../services/api/areaProviderDemandsApi';
import {
  createUser,
  deactivateUser,
  deleteUser,
  revealUserPin,
  restoreUser,
  setUserPin,
} from '../services/api/usersApi';
import {getServiceCategories} from '../services/api/serviceCategoriesApi';
import {
  getGeographyMeta,
  invalidateGeographyListCache,
  type GeographyMetaDistrict,
  type GeographyMetaState,
} from '../services/api/geographyApi';
import {formatAddress, formatPincode} from '../utils/address';
import {
  formatPhoneDisplay,
  localTenDigits,
  phoneSearchValue,
  toE164,
} from '../utils/phone';
import {formatLastUpdated} from '../utils/datetime';
import {sortByUpdatedThenCreated} from '../utils/sort';
import {CopyFeedbackButton} from '../components/CopyFeedbackButton';
import {PinCopyButton} from '../components/PinCopyButton';
import {RoleBadges} from '../components/RoleBadges';
import {partnerServiceSummaries} from '../utils/partnerServices';
import '../styles/pages.css';

const PAGE_SIZE = 50;
const ALL_STATES = '__all_states__';
const ALL_DISTRICTS = '__all_districts__';

function phoneCopyDigits(
  ...candidates: Array<string | null | undefined>
): string {
  const raw = candidates.find((c) => (c || '').trim()) || '';
  const ten = localTenDigits(raw);
  return ten.length === 10 ? ten : '';
}

const STATUS_VALUES = ['pending', 'approved', 'rejected'] as const;

function approvalStatusLabel(
  status: string,
  t: (key: string) => string,
): string {
  if (
    status === 'pending' ||
    status === 'approved' ||
    status === 'rejected'
  ) {
    return t(`filter_${status}`);
  }
  return status;
}

export function ProvidersPage() {
  const {t} = useTranslation();
  const statusOptions = useMemo(
    () =>
      STATUS_VALUES.map((value) => ({
        value,
        label: t(`filter_${value}`),
      })),
    [t],
  );
  const [rows, setRows] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [filterStateId, setFilterStateId] = useState(ALL_STATES);
  const [filterDistrictId, setFilterDistrictId] = useState(ALL_DISTRICTS);
  const [revealedPins, setRevealedPins] = useState<Record<string, string>>({});
  const [revealBusyId, setRevealBusyId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);
  const [areaDemands, setAreaDemands] = useState<AreaProviderDemand[]>([]);
  const [areaDemandsBusyId, setAreaDemandsBusyId] = useState<string | null>(
    null,
  );

  const [serviceOptions, setServiceOptions] = useState<
    {value: string; label: string}[]
  >([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createPincode, setCreatePincode] = useState('');
  const [createStateId, setCreateStateId] = useState('');
  const [createDistrictId, setCreateDistrictId] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [geoStates, setGeoStates] = useState<GeographyMetaState[]>([]);
  const [geoDistricts, setGeoDistricts] = useState<GeographyMetaDistrict[]>(
    [],
  );
  const [createService, setCreateService] = useState('');
  const [createExperience, setCreateExperience] = useState('');
  const [createRating, setCreateRating] = useState('');
  const [createPin, setCreatePin] = useState('');
  const [createGeneratePin, setCreateGeneratePin] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [pinUser, setPinUser] = useState<Provider | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Provider | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<Provider | null>(
    null,
  );
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);
  const [phoneVerifyBusyId, setPhoneVerifyBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedState =
        filterStateId !== ALL_STATES
          ? geoStates.find((s) => s._id === filterStateId)
          : undefined;
      const selectedDistrict =
        filterDistrictId !== ALL_DISTRICTS
          ? geoDistricts.find((d) => d._id === filterDistrictId)
          : undefined;
      const result = await getProvidersPage({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        includeInactive,
        ...(filterStateId !== ALL_STATES
          ? {
              stateId: filterStateId,
              state: selectedState?.name,
            }
          : {}),
        ...(filterDistrictId !== ALL_DISTRICTS
          ? {
              districtId: filterDistrictId,
              district: selectedDistrict?.name,
            }
          : {}),
      });
      setRows(sortByUpdatedThenCreated(result.items));
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [
    filterDistrictId,
    filterStateId,
    geoDistricts,
    geoStates,
    includeInactive,
    page,
    t,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAreaDemands = useCallback(async () => {
    try {
      const rows = await getAreaProviderDemands({status: 'open', limit: 30});
      setAreaDemands(rows);
    } catch {
      setAreaDemands([]);
    }
  }, []);

  useEffect(() => {
    void loadAreaDemands();
  }, [loadAreaDemands]);

  const onResolveDemand = async (
    demand: AreaProviderDemand,
    status: 'resolved' | 'dismissed',
  ) => {
    setAreaDemandsBusyId(demand._id);
    try {
      await updateAreaProviderDemand(demand._id, {status});
      setAreaDemands((prev) => prev.filter((d) => d._id !== demand._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setAreaDemandsBusyId(null);
    }
  };

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
    void getGeographyMeta()
      .then((meta) => {
        setGeoStates(meta.states || []);
        setGeoDistricts(meta.districts || []);
      })
      .catch(() => {
        setGeoStates([]);
        setGeoDistricts([]);
      });
  }, []);

  const stateOptions = useMemo(
    () => geoStates.map((s) => ({value: s._id, label: s.name})),
    [geoStates],
  );

  const districtOptions = useMemo(
    () =>
      geoDistricts
        .filter((d) => !createStateId || d.stateId === createStateId)
        .map((d) => ({value: d._id, label: d.name})),
    [geoDistricts, createStateId],
  );

  const filterStateOptions = useMemo(
    () => [
      {value: ALL_STATES, label: t('filterAllStates')},
      ...geoStates.map((s) => ({value: s._id, label: s.name})),
    ],
    [geoStates, t],
  );

  const filterDistrictOptions = useMemo(
    () => [
      {value: ALL_DISTRICTS, label: t('filterAllDistricts')},
      ...geoDistricts
        .filter(
          (d) => filterStateId === ALL_STATES || d.stateId === filterStateId,
        )
        .map((d) => ({value: d._id, label: d.name})),
    ],
    [filterStateId, geoDistricts, t],
  );

  useEffect(() => {
    if (!successBanner) return;
    const timer = window.setTimeout(() => setSuccessBanner(null), 45000);
    return () => window.clearTimeout(timer);
  }, [successBanner]);

  useEffect(() => {
    if (!Object.keys(revealedPins).length) return;
    const timer = window.setTimeout(() => setRevealedPins({}), 45000);
    return () => window.clearTimeout(timer);
  }, [revealedPins]);

  useEffect(() => {
    if (!statusEditId) return;
    const onDown = (e: MouseEvent) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(e.target as Node)
      ) {
        setStatusEditId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [statusEditId]);

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateName('');
    setCreatePhone('');
    setCreateAddress('');
    setCreatePincode('');
    setCreateStateId('');
    setCreateDistrictId('');
    setCreateCity('');
    setCreateService('');
    setCreateExperience('');
    setCreateRating('');
    setCreatePin('');
    setCreateGeneratePin(true);
    setCreateError(null);
    setCreating(false);
  };

  const applyStatus = async (
    row: Provider,
    status: 'pending' | 'approved' | 'rejected',
    reason?: string,
  ) => {
    setStatusBusyId(row._id);
    setError(null);
    try {
      await updateProviderApproval(row._id, status, reason);
      setStatusEditId(null);
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setStatusBusyId(null);
    }
  };

  const onStatusPick = (
    row: Provider,
    status: 'pending' | 'approved' | 'rejected',
  ) => {
    if (status === 'rejected') {
      setStatusEditId(null);
      setRejectTarget(row);
      setRejectReason('');
      return;
    }
    void applyStatus(row, status);
  };

  const onCreateProvider = async () => {
    setCreateError(null);
    const ten = localTenDigits(createPhone);
    if (ten.length !== 10) {
      setCreateError(t('phoneTenDigits'));
      return;
    }
    if (!createService) {
      setCreateError(t('serviceRequired'));
      return;
    }
    if (!createStateId) {
      setCreateError(t('geoStateRequired'));
      return;
    }
    if (!createDistrictId) {
      setCreateError(t('geoDistrictRequired'));
      return;
    }
    if (createPin && !/^\d{6}$/.test(createPin)) {
      setCreateError(t('pinMustBeSix'));
      return;
    }
    setCreating(true);
    try {
      const experience =
        createExperience.trim() === ''
          ? undefined
          : Number(createExperience);
      const rating =
        createRating.trim() === '' ? undefined : Number(createRating);
      const selectedState = geoStates.find((s) => s._id === createStateId);
      const selectedDistrict = geoDistricts.find(
        (d) => d._id === createDistrictId,
      );
      const districtName = selectedDistrict?.name || '';
      const cityName = createCity.trim() || districtName;
      const created = await createUser({
        name: createName.trim() || undefined,
        phone: toE164(ten),
        role: 'provider',
        serviceType: createService,
        serviceCategories: [createService],
        address: createAddress.trim() || undefined,
        city: cityName || undefined,
        state: selectedState?.name || undefined,
        district: districtName || undefined,
        stateId: createStateId || undefined,
        districtId: createDistrictId || undefined,
        pincode: createPincode.trim() || undefined,
        experience: Number.isFinite(experience) ? experience : undefined,
        rating: Number.isFinite(rating) ? rating : undefined,
      });
      invalidateGeographyListCache({
        districtId: createDistrictId,
        stateId: createStateId,
      });
      let pinForBanner: string | undefined;
      if (createGeneratePin) {
        const pinResult = await setUserPin(
          created._id,
          createPin.trim() || undefined,
          'partner',
        );
        pinForBanner = pinResult.loginPin;
        setRevealedPins((m) => ({...m, [created._id]: pinResult.loginPin}));
      }
      const {name} = userLabel(created);
      closeCreate();
      if (pinForBanner) {
        setSuccessBanner(
          pinSuccessBanner(
            t,
            {
              name: created.name || createName,
              phone: created.phone || toE164(ten),
            },
            pinForBanner,
          ),
        );
      } else {
        setSuccessBanner({
          title: t('providerCreatedTitle'),
          detail: t('providerCreatedDetail', {name}),
        });
      }
      setPage(0);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setCreating(false);
    }
  };

  const onSetPin = async () => {
    if (!pinUser) return;
    setPinBusy(true);
    setPinMessage(null);
    setError(null);
    try {
      const userId = pinUser.userId || pinUser._id;
      const result = await setUserPin(
        userId,
        pinValue.trim() || undefined,
        'partner',
      );
      setPinUser(null);
      setPinValue('');
      setSuccessBanner(
        pinSuccessBanner(
          t,
          {
            name: pinUser.name || pinUser.displayName,
            phone: pinUser.phone || pinUser.phoneNumber,
          },
          result.loginPin,
        ),
      );
      setRevealedPins((m) => ({...m, [userId]: result.loginPin}));
      await load();
    } catch (err) {
      setPinMessage(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setPinBusy(false);
    }
  };

  const onRevealPin = async (row: Provider) => {
    const userId = row.userId || row._id;
    if (revealedPins[userId]) {
      setRevealedPins((m) => {
        const next = {...m};
        delete next[userId];
        return next;
      });
      return;
    }
    setRevealBusyId(userId);
    setError(null);
    try {
      const result = await revealUserPin(userId, 'partner');
      if (!result.loginPin) {
        setError(t('pinRevealFailed'));
        return;
      }
      setRevealedPins((m) => ({...m, [userId]: result.loginPin as string}));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setRevealBusyId(null);
    }
  };

  const onDeactivate = async () => {
    if (!deactivateTarget) return;
    if (!deactivateReason.trim()) {
      setDeactivateError(t('deactivationReasonRequired'));
      return;
    }
    setDeactivateBusy(true);
    setDeactivateError(null);
    try {
      const name =
        deactivateTarget.businessName ||
        deactivateTarget.name ||
        deactivateTarget.displayName ||
        deactivateTarget._id;
      await deactivateUser(deactivateTarget._id, deactivateReason.trim(), 'partner');
      setDeactivateTarget(null);
      setDeactivateReason('');
      setSuccessBanner({
        title: t('accountDeactivatedTitle'),
        detail: t('accountDeactivatedDetail', {name}),
      });
      await load();
    } catch (err) {
      setDeactivateError(
        err instanceof Error ? err.message : t('errorGeneric'),
      );
    } finally {
      setDeactivateBusy(false);
    }
  };

  const onRestore = async (row: Provider) => {
    setRestoreBusyId(row._id);
    setError(null);
    try {
      await restoreUser(row._id, 'partner');
      setSuccessBanner({
        title: t('accountRestoredTitle'),
        detail: t('accountRestoredDetail', {
          name: row.businessName || row.name || row.displayName || row._id,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setRestoreBusyId(null);
    }
  };

  const onDeleteProvider = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const name =
        deleteTarget.businessName ||
        deleteTarget.name ||
        deleteTarget.displayName ||
        deleteTarget._id;
      await deleteUser(deleteTarget._id);
      setDeleteTarget(null);
      setSuccessBanner({
        title: t('userDeletedTitle'),
        detail: t('userDeletedDetail', {name}),
      });
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const onTogglePhoneVerified = async (row: Provider) => {
    setPhoneVerifyBusyId(row._id);
    setError(null);
    try {
      const next = !row.phoneVerified;
      const updated = await updateProvider(row._id, {phoneVerified: next});
      setRows((prev) =>
        prev.map((r) =>
          r._id === row._id
            ? {...r, phoneVerified: updated.phoneVerified ?? next}
            : r,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setPhoneVerifyBusyId(null);
    }
  };

  const columns = useMemo<VirtualTableColumn<Provider>[]>(
    () => [
      {
        key: 'name',
        header: t('name'),
        width: '8rem',
        filterable: true,
        filterPlaceholder: t('searchName'),
        filterValue: (row) =>
          row.businessName || row.name || row.displayName || '',
        render: (row) => {
          const label =
            row.businessName || row.name || row.displayName || '—';
          return (
            <span className="name-with-roles">
              <span className="cell-clamp" title={label !== '—' ? label : undefined}>
                {label}
              </span>
              <RoleBadges
                hasPartner
                hasCustomer={Boolean(row.hasCustomerProfile)}
              />
            </span>
          );
        },
      },
      {
        key: 'phone',
        header: t('phone'),
        width: '11.5rem',
        filterable: true,
        filterPlaceholder: t('searchPhone'),
        filterValue: (row) => phoneSearchValue(row.phone, row.phoneNumber),
        render: (row) => {
          const display = formatPhoneDisplay(row.phone, row.phoneNumber);
          const copyDigits = phoneCopyDigits(row.phone, row.phoneNumber);
          return (
            <span className="phone-verify-cell">
              <span className="phone-number-row">
                <span className="phone-number-text" title={display}>
                  {display}
                </span>
                {copyDigits ? (
                  <CopyFeedbackButton
                    text={copyDigits}
                    ariaLabel={t('copyPhone')}
                    title={t('copyPhone')}
                  />
                ) : null}
              </span>
              <label className="checkbox-inline phone-verified-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(row.phoneVerified)}
                  disabled={phoneVerifyBusyId === row._id}
                  onChange={() => void onTogglePhoneVerified(row)}
                  title={t('markPhoneVerified')}
                  aria-label={t('markPhoneVerified')}
                />
                <span className="muted compact">
                  {row.phoneVerified ? t('phoneVerified') : t('phoneUnverified')}
                </span>
              </label>
            </span>
          );
        },
      },
      {
        key: 'address',
        header: t('address'),
        width: '14rem',
        filterable: true,
        filterPlaceholder: t('searchAddress'),
        filterValue: (row) => formatAddress(row.location, row.address as never),
        render: (row) => (
          <span
            className="cell-clamp"
            title={formatAddress(row.location, row.address as never)}>
            {formatAddress(row.location, row.address as never)}
          </span>
        ),
      },
      {
        key: 'pincode',
        header: t('pincode'),
        width: '8rem',
        filterable: true,
        filterPlaceholder: t('searchPincode'),
        filterValue: (row) => {
          const pin = formatPincode(
            row.location,
            typeof row.address === 'object' ? row.address : undefined,
          );
          return pin === '—' ? '' : pin;
        },
        render: (row) =>
          formatPincode(
            row.location,
            typeof row.address === 'object' ? row.address : undefined,
          ),
      },
      {
        key: 'services',
        header: t('services'),
        width: '14rem',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('filterServices'),
        filterValue: (row) =>
          partnerServiceSummaries(row)
            .map((s) => s.name)
            .join(' '),
        render: (row) => {
          const services = partnerServiceSummaries(row);
          if (!services.length) return '—';
          return (
            <ul className="provider-services-cell">
              {services.map((service) => {
                const verified = service.verificationStatus === 'approved';
                const pending = service.verificationStatus !== 'approved';
                return (
                  <li key={service.name}>
                    <strong>{service.name}</strong>
                    <span className="muted compact">
                      {verified ? t('serviceVerified') : pending ? t('servicePending') : t('serviceRequiredStatus')}
                      {' · '}
                      {service.active
                        ? t('serviceAvailabilityOn')
                        : t('serviceAvailabilityOff')}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        },
      },
      {
        key: 'status',
        header: t('accountStatus'),
        width: '8.5rem',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('filterStatuses'),
        filterOptions: statusOptions,
        filterValue: (row) => row.approvalStatus || row.status || '',
        render: (row) => {
          const status = (
            row.approvalStatus ||
            row.status ||
            'pending'
          ).toLowerCase();
          const editing = statusEditId === row._id;
          return (
            <span className="status-edit-cell">
              <StatusChip
                status={status}
                label={approvalStatusLabel(status, t)}
              />
              <Button variant="ghost" className="icon-only" disabled={statusBusyId === row._id} aria-label={t('editStatus')} title={t('editStatus')} onClick={() =>
                  setStatusEditId(editing ? null : row._id)
                }>
                <Icon name="edit" size={16} />
              </Button>
              {editing ? (
                <div className="status-edit-menu" ref={statusMenuRef}>
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`status-edit-option${
                        opt.value === status ? ' is-active' : ''
                      }`}
                      disabled={statusBusyId === row._id}
                      onClick={() => onStatusPick(row, opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </span>
          );
        },
      },
      {
        key: 'access',
        header: t('access'),
        width: '7rem',
        render: (row) =>
          row.isActive === false ? (
            <StatusChip status="cancelled" label={t('inactive')} />
          ) : (
            <StatusChip status="active" label={t('active')} />
          ),
      },
      {
        key: 'pin',
        header: t('partnerLoginPin'),
        width: '12rem',
        render: (row) => {
          const userId = row.userId || row._id;
          const pin = revealedPins[userId];
          return (
            <span className="pin-cell">
              <span className="pin-cell-value">
                {pin ? <code>{pin}</code> : row.hasPin ? '••••••' : '—'}
              </span>
              <span className="pin-cell-actions">
                {row.hasPin ? (
                  <Button
                    variant="ghost"
                    className="icon-only"
                    disabled={revealBusyId === userId}
                    aria-label={pin ? t('hidePassword') : t('revealPin')}
                    title={pin ? t('hidePassword') : t('revealPin')}
                    onClick={() => void onRevealPin(row)}>
                    <Icon
                      name={pin ? 'visibility_off' : 'visibility'}
                      size={18}
                    />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  className="icon-only"
                  aria-label={t('resetPartnerPin')}
                  title={t('resetPartnerPin')}
                  onClick={() => {
                    setPinUser(row);
                    setPinValue('');
                    setPinMessage(null);
                  }}>
                  <Icon name="lock_reset" size={18} />
                </Button>
                <PinCopyButton
                  revealedPin={pin}
                  fetchPin={async () => {
                    const result = await revealUserPin(userId, 'partner');
                    return result.loginPin ?? null;
                  }}
                  ariaLabel={t('copyPin')}
                  title={t('copyPin')}
                />
              </span>
            </span>
          );
        },
      },
      {
        key: 'createdAt',
        header: t('createdDate'),
        width: '10rem',
        render: (row) => formatLastUpdated(row.createdAt),
      },
      {
        key: 'actions',
        header: t('actions'),
        width: '13rem',
        render: (row) => (
          <span className="actions table-actions">
            <Link className="hs-btn hs-btn--ghost hs-btn--md" to={`/providers/${row._id}`}>
              {t('viewUpdate')}
            </Link>
            <Button variant="ghost" className="icon-only" aria-label={t('resetPartnerPin')} title={t('resetPartnerPin')} onClick={() => {
                setPinUser(row);
                setPinValue('');
                setPinMessage(null);
              }}>
              <Icon name="lock_reset" size={18} />
            </Button>
            {row.isActive === false ? (
              <Button variant="ghost" className="icon-only" disabled={restoreBusyId === row._id} aria-label={t('restore')} title={t('restore')} onClick={() => void onRestore(row)}>
                <Icon name="safety_check" size={18} />
              </Button>
            ) : (
              <Button variant="ghost" className="icon-only" aria-label={t('deactivate')} title={t('deactivate')} onClick={() => {
                  setDeactivateTarget(row);
                  setDeactivateReason('');
                  setDeactivateError(null);
                }}>
                <Icon name="safety_check_off" size={18} />
              </Button>
            )}
            <Button variant="ghost" className="icon-only" aria-label={t('delete')} title={t('delete')} onClick={() => {
                setDeleteTarget(row);
                setDeleteError(null);
              }}>
              <Icon name="delete" size={18} />
            </Button>
          </span>
        ),
      },
    ],
    [
      phoneVerifyBusyId,
      revealBusyId,
      revealedPins,
      restoreBusyId,
      statusBusyId,
      statusEditId,
      statusOptions,
      t,
    ],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="providers-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('providersTitle')}</h1>
          <p>{t('providersLead')}</p>
        </div>
        <div className="row-header-actions">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(0);
              }}
            />
            {t('showInactive')}
          </label>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            {t('addProvider')}
          </Button>
        </div>
      </header>
      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="provider-create-banner"
        />
      ) : null}

      {areaDemands.length > 0 ? (
        <section
          className="card"
          style={{marginBottom: '1rem', padding: '1rem'}}
          aria-label="Area provider requests">
          <h2 style={{fontSize: '1.05rem', margin: '0 0 0.35rem'}}>
            Customers requesting providers in their area
          </h2>
          <p style={{margin: '0 0 0.75rem', opacity: 0.8, fontSize: '0.9rem'}}>
            No matching providers nearby — customer asked admin to arrange this
            service type.
          </p>
          <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
            {areaDemands.map((d) => (
              <li
                key={d._id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem 1rem',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0',
                  borderTop: '1px solid var(--border, #e5e5e5)',
                }}>
                <div>
                  <strong>{d.serviceType}</strong>
                  <span style={{opacity: 0.75}}>
                    {' '}
                    · {d.pincode}
                    {d.district || d.city
                      ? ` · ${d.district || d.city}`
                      : ''}
                  </span>
                  <div style={{fontSize: '0.85rem', opacity: 0.8}}>
                    {d.customerName || 'Customer'}
                    {d.customerPhone ? ` · ${d.customerPhone}` : ''}
                    {d.address ? ` · ${d.address}` : ''}
                  </div>
                </div>
                <div style={{display: 'flex', gap: '0.4rem'}}>
                  <Button variant="ghost" disabled={areaDemandsBusyId === d._id} onClick={() => void onResolveDemand(d, 'dismissed')}>
                    {t('dismiss')}
                  </Button>
                  <Button variant="primary" disabled={areaDemandsBusyId === d._id} onClick={() => void onResolveDemand(d, 'resolved')}>
                    {t('markResolved')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="filter-row">
        <div className="filter-inline" style={{minWidth: '12rem'}}>
          <Select
            options={filterStateOptions}
            value={filterStateId}
            placeholder={t('geoState')}
            showSearch
            searchPlaceholder={t('searchState')}
            emptyMessage={t('noStatesFound')}
            onChange={(value) => {
              setFilterStateId(value);
              setFilterDistrictId(ALL_DISTRICTS);
              setPage(0);
            }}
          />
        </div>
        <div className="filter-inline" style={{minWidth: '12rem'}}>
          <Select
            options={filterDistrictOptions}
            value={filterDistrictId}
            placeholder={t('geoDistrict')}
            showSearch
            searchPlaceholder={t('searchDistrict')}
            emptyMessage={t('noDistrictsFound')}
            disabled={filterStateId === ALL_STATES}
            onChange={(value) => {
              setFilterDistrictId(value);
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

      {createOpen ? (
        <Dialog open
          title={t('addProviderTitle')}
          onClose={closeCreate}
          testId="providers-create-modal">
          <p className="modal-lead">{t('addProviderLead')}</p>
          <div className="modal-form">
            <label>
              {t('name')}
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoComplete="name"
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
                  value={createPhone}
                  placeholder={t('phoneTenDigitsHint')}
                  onChange={(e) =>
                    setCreatePhone(localTenDigits(e.target.value).slice(0, 10))
                  }
                  autoComplete="tel-national"
                  required
                />
              </div>
            </label>
            <label>
              {t('locationAddress')}
              <input
                value={createAddress}
                onChange={(e) => setCreateAddress(e.target.value)}
                placeholder={t('addressPlaceholder')}
              />
            </label>
            <div className="modal-form-row">
              <label>
                {t('geoState')}
                <Select
                  options={stateOptions}
                  value={createStateId}
                  placeholder={t('geoState')}
                  showSearch
                  searchPlaceholder={t('searchState')}
                  emptyMessage={t('noStatesFound')}
                  onChange={(value) => {
                    setCreateStateId(value);
                    setCreateDistrictId('');
                    setCreateCity('');
                    setCreatePincode('');
                  }}
                />
              </label>
              <label>
                {t('geoDistrict')}
                <Select
                  options={districtOptions}
                  value={createDistrictId}
                  placeholder={t('geoDistrict')}
                  showSearch
                  searchPlaceholder={t('searchDistrict')}
                  emptyMessage={t('noDistrictsFound')}
                  onChange={(value) => {
                    setCreateDistrictId(value);
                    const d = geoDistricts.find((x) => x._id === value);
                    if (d) {
                      if (!createCity.trim()) setCreateCity(d.name);
                      if (d.pincode) setCreatePincode(d.pincode);
                    }
                  }}
                />
              </label>
            </div>
            <div className="modal-form-row">
              <label>
                {t('geoCity')}
                <input
                  value={createCity}
                  onChange={(e) => setCreateCity(e.target.value)}
                  placeholder={t('geoDistrict')}
                />
              </label>
              <label>
                {t('pincode')}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={createPincode}
                  onChange={(e) =>
                    setCreatePincode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="560001"
                />
              </label>
            </div>
            <label>
              {t('serviceType')}
              <Select
                options={serviceOptions}
                value={createService}
                placeholder={t('selectServiceType')}
                showSearch
                onChange={setCreateService}
              />
            </label>
            <div className="modal-form-row">
              <label>
                {t('experienceOptional')}
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={createExperience}
                  onChange={(e) => setCreateExperience(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label>
                {t('ratingOptional')}
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={createRating}
                  onChange={(e) => setCreateRating(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
            <fieldset className="pin-create-fieldset">
              <legend>{t('loginPin')}</legend>
              <label className="checkbox-inline pin-create-check">
                <input
                  type="checkbox"
                  checked={createGeneratePin}
                  onChange={(e) => {
                    setCreateGeneratePin(e.target.checked);
                    if (!e.target.checked) setCreatePin('');
                  }}
                />
                {t('generatePinOnCreate')}
              </label>
              {createGeneratePin ? (
                <label>
                  {t('loginPin')}
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t('pinAutoGenerate')}
                    value={createPin}
                    onChange={(e) =>
                      setCreatePin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                  />
                </label>
              ) : null}
            </fieldset>
          </div>
          {createError ? <p className="error-text">{createError}</p> : null}
          <div className="modal-actions">
            <Button variant="primary" disabled={creating} onClick={() => void onCreateProvider()}>
              {creating ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={closeCreate}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {pinUser ? (
        <Dialog open
          title={t('resetPartnerPin')}
          onClose={() => setPinUser(null)}
          testId="providers-set-pin-modal">
          <p className="modal-lead">{t('resetPartnerPinLead')}</p>
          <p className="modal-lead" style={{fontWeight: 600, color: 'var(--color-text)'}}>
            {pinUser.name || pinUser.displayName || pinUser.phone}
          </p>
          <label>
            {t('loginPin')}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder={t('pinAutoGenerate')}
              value={pinValue}
              onChange={(e) =>
                setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
            />
          </label>
          {pinMessage ? <p className="error-text">{pinMessage}</p> : null}
          <div className="modal-actions">
            <Button variant="primary" disabled={pinBusy} onClick={() => void onSetPin()}>
              {pinBusy ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={() => setPinUser(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {rejectTarget ? (
        <Dialog open
          title={t('rejectProvider')}
          onClose={() => setRejectTarget(null)}>
          <label>
            {t('rejectionReason')}
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              autoFocus
            />
          </label>
          <div className="modal-actions">
            <Button variant="danger" disabled={statusBusyId === rejectTarget._id} onClick={() => {
                if (!rejectReason.trim()) {
                  setError(t('rejectionRequired'));
                  return;
                }
                void applyStatus(rejectTarget, 'rejected', rejectReason.trim());
              }}>
              {t('reject')}
            </Button>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {deactivateTarget ? (
        <Dialog open
          title={t('deactivatePartnerTitle')}
          onClose={() => setDeactivateTarget(null)}
          testId="providers-deactivate-modal">
          <p className="modal-lead">
            {t('deactivatePartnerLead', {
              name:
                deactivateTarget.businessName ||
                deactivateTarget.name ||
                deactivateTarget.displayName ||
                deactivateTarget._id,
            })}
          </p>
          <label>
            {t('deactivationReason')}
            <textarea
              rows={4}
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              autoFocus
            />
          </label>
          {deactivateError ? (
            <p className="error-text">{deactivateError}</p>
          ) : null}
          <div className="modal-actions">
            <Button variant="danger" disabled={deactivateBusy} onClick={() => void onDeactivate()}>
              {deactivateBusy ? t('saving') : t('deactivate')}
            </Button>
            <Button variant="ghost" onClick={() => setDeactivateTarget(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {deleteTarget ? (
        <Dialog open
          title={t('deleteUserTitle')}
          onClose={() => setDeleteTarget(null)}
          testId="providers-delete-modal">
          <p className="modal-lead">
            {t('deleteUserLead', {
              name:
                deleteTarget.businessName ||
                deleteTarget.name ||
                deleteTarget.displayName ||
                deleteTarget._id,
            })}
          </p>
          {deleteError ? <p className="error-text">{deleteError}</p> : null}
          <div className="modal-actions">
            <Button variant="danger" disabled={deleteBusy} onClick={() => void onDeleteProvider()}>
              {deleteBusy ? t('saving') : t('confirmDelete')}
            </Button>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
