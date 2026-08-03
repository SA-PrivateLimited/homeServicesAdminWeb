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
  SuccessBanner,
  pinSuccessBanner,
  userLabel,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {
  createUser,
  deactivateUser,
  getUsersPage,
  restoreUser,
  revealUserPin,
  setUserPin,
  updateUser,
  type User,
} from '../services/api/usersApi';
import {
  getGeographyMeta,
  type GeographyMetaDistrict,
  type GeographyMetaState,
} from '../services/api/geographyApi';
import {formatAddress} from '../utils/address';
import {
  formatPhoneDisplay,
  localTenDigits,
  phoneSearchValue,
  toE164,
} from '../utils/phone';
import {formatLastUpdated} from '../utils/datetime';
import '../styles/pages.css';

const PAGE_SIZE = 50;
const ALL_STATES = '__all_states__';
const ALL_DISTRICTS = '__all_districts__';

export function CustomersPage() {
  const {t} = useTranslation();
  const [rows, setRows] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [filterStateId, setFilterStateId] = useState(ALL_STATES);
  const [filterDistrictId, setFilterDistrictId] = useState(ALL_DISTRICTS);
  const [pinUser, setPinUser] = useState<User | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);
  const [revealedPins, setRevealedPins] = useState<Record<string, string>>({});
  const [revealBusyId, setRevealBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createLandmark, setCreateLandmark] = useState('');
  const [createPincode, setCreatePincode] = useState('');
  const [createStateId, setCreateStateId] = useState('');
  const [createDistrictId, setCreateDistrictId] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [geoStates, setGeoStates] = useState<GeographyMetaState[]>([]);
  const [geoDistricts, setGeoDistricts] = useState<GeographyMetaDistrict[]>(
    [],
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createPin, setCreatePin] = useState('');
  const [createGeneratePin, setCreateGeneratePin] = useState(true);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLandmark, setEditLandmark] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editStateId, setEditStateId] = useState('');
  const [editDistrictId, setEditDistrictId] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
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
      const result = await getUsersPage({
        role: 'customer',
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
      setRows(result.items);
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

  const editDistrictOptions = useMemo(
    () =>
      geoDistricts
        .filter((d) => !editStateId || d.stateId === editStateId)
        .map((d) => ({value: d._id, label: d.name})),
    [geoDistricts, editStateId],
  );

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateName('');
    setCreatePhone('');
    setCreateAddress('');
    setCreateLandmark('');
    setCreatePincode('');
    setCreateStateId('');
    setCreateDistrictId('');
    setCreateCity('');
    setCreatePin('');
    setCreateGeneratePin(true);
    setCreateError(null);
    setCreating(false);
  };

  const onCreateCustomer = async () => {
    setCreateError(null);
    const ten = localTenDigits(createPhone);
    if (ten.length !== 10) {
      setCreateError(t('phoneTenDigits'));
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
      const selectedState = geoStates.find((s) => s._id === createStateId);
      const selectedDistrict = geoDistricts.find(
        (d) => d._id === createDistrictId,
      );
      const districtName = selectedDistrict?.name || '';
      const cityName = createCity.trim() || districtName;
      const created = await createUser({
        name: createName.trim() || undefined,
        phone: toE164(ten),
        role: 'customer',
        address: createAddress.trim() || undefined,
        landmark: createLandmark.trim() || undefined,
        city: cityName || undefined,
        state: selectedState?.name || undefined,
        district: districtName || undefined,
        stateId: createStateId || undefined,
        districtId: createDistrictId || undefined,
        pincode: createPincode.trim() || undefined,
      });
      let pinForBanner: string | undefined;
      if (createGeneratePin) {
        const pinResult = await setUserPin(
          created._id,
          createPin.trim() || undefined,
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
          title: t('customerCreatedTitle'),
          detail: t('customerCreatedDetail', {name}),
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

  const closeEdit = () => {
    setEditUser(null);
    setEditName('');
    setEditAddress('');
    setEditLandmark('');
    setEditPincode('');
    setEditStateId('');
    setEditDistrictId('');
    setEditCity('');
    setEditError(null);
    setEditing(false);
  };

  const openEdit = (row: User) => {
    const loc = row.homeAddress || row.location;
    setEditUser(row);
    setEditName(row.name || row.displayName || '');
    setEditAddress(loc?.address || '');
    setEditLandmark(loc?.landmark || '');
    setEditPincode(loc?.pincode || '');
    setEditStateId(loc?.stateId || '');
    setEditDistrictId(loc?.districtId || '');
    setEditCity(loc?.city || loc?.district || '');
    setEditError(null);
  };

  const onSaveCustomer = async () => {
    if (!editUser) return;
    setEditError(null);
    if (!editStateId) {
      setEditError(t('geoStateRequired'));
      return;
    }
    if (!editDistrictId) {
      setEditError(t('geoDistrictRequired'));
      return;
    }
    setEditing(true);
    try {
      const selectedState = geoStates.find((s) => s._id === editStateId);
      const selectedDistrict = geoDistricts.find((d) => d._id === editDistrictId);
      const districtName = selectedDistrict?.name || '';
      const cityName = editCity.trim() || districtName;
      await updateUser(editUser._id, {
        name: editName.trim() || undefined,
        address: editAddress.trim() || undefined,
        landmark: editLandmark.trim() || undefined,
        city: cityName || undefined,
        state: selectedState?.name || undefined,
        district: districtName || undefined,
        stateId: editStateId || undefined,
        districtId: editDistrictId || undefined,
        pincode: editPincode.trim() || undefined,
      });
      closeEdit();
      setSuccessBanner({
        title: t('customerSavedTitle'),
        detail: t('customerSavedDetail'),
      });
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setEditing(false);
    }
  };

  const onRevealPin = async (row: User) => {
    if (revealedPins[row._id]) {
      setRevealedPins((m) => {
        const next = {...m};
        delete next[row._id];
        return next;
      });
      return;
    }
    setRevealBusyId(row._id);
    setError(null);
    try {
      const result = await revealUserPin(row._id);
      if (!result.loginPin) {
        setError(t('pinRevealFailed'));
        return;
      }
      setRevealedPins((m) => ({...m, [row._id]: result.loginPin as string}));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setRevealBusyId(null);
    }
  };

  const onSetPin = async () => {
    if (!pinUser) return;
    setPinBusy(true);
    setPinMessage(null);
    setError(null);
    try {
      const result = await setUserPin(
        pinUser._id,
        pinValue.trim() || undefined,
      );
      const userId = pinUser._id;
      const banner = pinSuccessBanner(t, pinUser, result.loginPin);
      setPinUser(null);
      setPinValue('');
      setPinMessage(null);
      setSuccessBanner(banner);
      setRevealedPins((m) => ({...m, [userId]: result.loginPin}));
      await load();
    } catch (err) {
      setPinMessage(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setPinBusy(false);
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
        deactivateTarget.name ||
        deactivateTarget.displayName ||
        deactivateTarget._id;
      await deactivateUser(deactivateTarget._id, deactivateReason.trim());
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

  const onRestore = async (row: User) => {
    setRestoreBusyId(row._id);
    setError(null);
    try {
      await restoreUser(row._id);
      setSuccessBanner({
        title: t('accountRestoredTitle'),
        detail: t('accountRestoredDetail', {
          name: row.name || row.displayName || row._id,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setRestoreBusyId(null);
    }
  };

  const openPinModal = (row: User) => {
    setPinUser(row);
    setPinValue('');
    setPinMessage(null);
  };

  const onTogglePhoneVerified = async (row: User) => {
    setPhoneVerifyBusyId(row._id);
    setError(null);
    try {
      const next = !row.phoneVerified;
      const updated = await updateUser(row._id, {phoneVerified: next});
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

  const columns = useMemo<VirtualTableColumn<User>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        filterable: true,
        filterPlaceholder: 'Search name',
        filterValue: (row) => row.name || row.displayName || '',
        render: (row) => row.name || row.displayName || '—',
      },
      {
        key: 'phone',
        header: 'Phone',
        filterable: true,
        filterPlaceholder: 'Search phone',
        filterValue: (row) => phoneSearchValue(row.phone, row.phoneNumber),
        render: (row) => (
          <span className="phone-verify-cell">
            <span>{formatPhoneDisplay(row.phone, row.phoneNumber)}</span>
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
        ),
      },
      {
        key: 'address',
        header: t('address'),
        filterable: true,
        filterPlaceholder: 'Search address',
        filterValue: (row) => formatAddress(row.homeAddress, row.location),
        width: '14rem',
        render: (row) => (
          <span
            className="cell-clamp"
            title={formatAddress(row.homeAddress, row.location)}>
            {formatAddress(row.homeAddress, row.location)}
          </span>
        ),
      },
      {
        key: 'account',
        header: t('accountStatus'),
        width: '7rem',
        render: (row) =>
          row.isActive === false ? (
            <span className="badge badge-rejected">{t('inactive')}</span>
          ) : (
            <span className="badge badge-approved">{t('active')}</span>
          ),
      },
      {
        key: 'pin',
        header: t('loginPin'),
        width: '8.5rem',
        render: (row) => {
          const pin = revealedPins[row._id];
          return (
            <span className="pin-cell">
              <span className="pin-cell-value">
                {pin ? <code>{pin}</code> : row.hasPin ? '••••••' : '—'}
              </span>
              {row.hasPin ? (
                <button
                  type="button"
                  className="btn btn-ghost icon-only"
                  disabled={revealBusyId === row._id}
                  aria-label={pin ? t('hidePassword') : t('revealPin')}
                  title={pin ? t('hidePassword') : t('revealPin')}
                  onClick={() => void onRevealPin(row)}>
                  <Icon
                    name={pin ? 'visibility_off' : 'visibility'}
                    size={18}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost icon-only"
                  aria-label={t('generatePin')}
                  title={t('generatePin')}
                  onClick={() => openPinModal(row)}>
                  <Icon name="lock_reset" size={18} />
                </button>
              )}
            </span>
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
        header: 'Actions',
        width: '8rem',
        render: (row) => (
          <span className="actions table-actions">
            <button
              type="button"
              className="btn btn-ghost icon-only"
              aria-label={t('edit')}
              title={t('edit')}
              onClick={() => openEdit(row)}>
              <Icon name="edit" size={18} />
            </button>
            {row.hasPin ? (
              <button
                type="button"
                className="btn btn-ghost icon-only"
                aria-label={t('setPin')}
                title={t('setPin')}
                onClick={() => openPinModal(row)}>
                <Icon name="lock_reset" size={18} />
              </button>
            ) : null}
            {row.isActive === false ? (
              <button
                type="button"
                className="btn btn-ghost icon-only"
                disabled={restoreBusyId === row._id}
                aria-label={t('restore')}
                title={t('restore')}
                onClick={() => void onRestore(row)}>
                <Icon name="safety_check" size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost icon-only"
                aria-label={t('deactivate')}
                title={t('deactivate')}
                onClick={() => {
                  setDeactivateTarget(row);
                  setDeactivateReason('');
                  setDeactivateError(null);
                }}>
                <Icon name="safety_check_off" size={18} />
              </button>
            )}
          </span>
        ),
      },
    ],
    [phoneVerifyBusyId, revealBusyId, revealedPins, restoreBusyId, t],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="customers-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('customersTitle')}</h1>
          <p>{t('customersLead')}</p>
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateOpen(true)}>
            {t('addCustomer')}
          </button>
        </div>
      </header>
      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="pin-success-banner"
        />
      ) : null}
      <div className="filter-row">
        <div className="filter-inline" style={{minWidth: '12rem'}}>
          <Select
            options={filterStateOptions}
            value={filterStateId}
            placeholder={t('geoState')}
            showSearch
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
        <Modal
          title={t('addCustomerTitle')}
          onClose={closeCreate}
          testId="customers-create-modal">
          <p className="muted compact">{t('addCustomerLead')}</p>
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
          <label>
            {t('landmarkOptional')}
            <input
              value={createLandmark}
              onChange={(e) => setCreateLandmark(e.target.value)}
              placeholder={t('landmarkOptional')}
            />
          </label>
          <div className="form-row">
            <label>
              {t('geoState')}
              <Select
                options={stateOptions}
                value={createStateId}
                placeholder={t('geoState')}
                showSearch
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
          <div className="form-row">
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
          {createError ? <p className="error-text">{createError}</p> : null}
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={creating}
              onClick={() => void onCreateCustomer()}>
              {creating ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeCreate}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}

      {editUser ? (
        <Modal
          title={t('editCustomerTitle')}
          onClose={closeEdit}
          testId="customers-edit-modal">
          <p className="muted compact">{t('editCustomerLead')}</p>
          <label>
            {t('name')}
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoComplete="name"
            />
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
            {t('landmarkOptional')}
            <input
              value={editLandmark}
              onChange={(e) => setEditLandmark(e.target.value)}
              placeholder={t('landmarkOptional')}
            />
          </label>
          <div className="form-row">
            <label>
              {t('geoState')}
              <Select
                options={stateOptions}
                value={editStateId}
                placeholder={t('geoState')}
                showSearch
                onChange={(value) => {
                  setEditStateId(value);
                  setEditDistrictId('');
                  setEditCity('');
                  setEditPincode('');
                }}
              />
            </label>
            <label>
              {t('geoDistrict')}
              <Select
                options={editDistrictOptions}
                value={editDistrictId}
                placeholder={t('geoDistrict')}
                showSearch
                onChange={(value) => {
                  setEditDistrictId(value);
                  const d = geoDistricts.find((x) => x._id === value);
                  if (d) {
                    if (!editCity.trim()) setEditCity(d.name);
                    if (d.pincode) setEditPincode(d.pincode);
                  }
                }}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              {t('geoCity')}
              <input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder={t('geoDistrict')}
              />
            </label>
            <label>
              {t('pincode')}
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={editPincode}
                onChange={(e) =>
                  setEditPincode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="560001"
              />
            </label>
          </div>
          {editError ? <p className="error-text">{editError}</p> : null}
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={editing}
              onClick={() => void onSaveCustomer()}>
              {editing ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeEdit}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}

      {pinUser ? (
        <Modal
          title={t('setPinTitle')}
          onClose={() => setPinUser(null)}
          testId="set-pin-modal">
          <p className="muted compact">{t('setPinLead')}</p>
          <p className="muted compact">
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
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pinBusy}
              onClick={() => void onSetPin()}>
              {pinBusy ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPinUser(null)}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}

      {deactivateTarget ? (
        <Modal
          title={t('deactivateTitle')}
          onClose={() => setDeactivateTarget(null)}
          testId="customers-deactivate-modal">
          <p className="muted compact">
            {t('deactivateLead', {
              name:
                deactivateTarget.name ||
                deactivateTarget.displayName ||
                deactivateTarget._id,
            })}
          </p>
          <label>
            {t('deactivationReason')}
            <textarea
              rows={3}
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              autoFocus
            />
          </label>
          {deactivateError ? (
            <p className="error-text">{deactivateError}</p>
          ) : null}
          <div className="actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={deactivateBusy}
              onClick={() => void onDeactivate()}>
              {deactivateBusy ? t('saving') : t('deactivate')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDeactivateTarget(null)}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
