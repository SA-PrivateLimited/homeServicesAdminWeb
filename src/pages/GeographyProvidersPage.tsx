import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  Select,
  VirtualTable,
  type VirtualTableColumn,
  Button,
  Dialog,
} from 'sapvt-ltd-web-packages';
import {
  assignProviderToDistrict,
  clearGeographyListCache,
  createProviderInDistrict,
  getGeographyProviders,
  peekGeographyProviders,
  type GeographyJobStats,
  type GeographyProviderRow,
  type GeographyServiceBreakdown,
} from '../services/api/geographyApi';
import {getProvidersPage, type Provider} from '../services/api/providersApi';
import {getServiceCategories} from '../services/api/serviceCategoriesApi';
import {
  formatPhoneDisplay,
  localTenDigits,
  toE164,
} from '../utils/phone';
import {sortByUpdatedThenCreated} from '../utils/sort';
import '../styles/pages.css';

function formatJobs(stats?: GeographyJobStats): string {
  if (!stats) return '—';
  return `${stats.completed}/${stats.pending}/${stats.cancelled}`;
}

function providerOptionLabel(p: Provider): string {
  const name = p.businessName || p.name || p.displayName || p._id;
  const phone = formatPhoneDisplay(p.phone || p.phoneNumber || '');
  const loc = [p.location?.district || p.location?.city, p.location?.state]
    .filter(Boolean)
    .join(', ');
  return [name, phone, loc].filter(Boolean).join(' · ');
}

async function fetchProvidersForAssign(): Promise<Provider[]> {
  const page = await getProvidersPage({limit: 100, offset: 0});
  return page.items;
}

export function GeographyProvidersPage() {
  const {districtId} = useParams();
  const {t} = useTranslation();
  const warm = districtId ? peekGeographyProviders(districtId) : null;
  const [rows, setRows] = useState<GeographyProviderRow[]>(
    () => warm?.providers || [],
  );
  const [serviceBreakdown, setServiceBreakdown] = useState<
    GeographyServiceBreakdown[]
  >(() => warm?.serviceBreakdown || []);
  const [district, setDistrict] = useState<{
    _id: string;
    name: string;
    stateId: string;
    stateName: string;
    pincode?: string;
  } | null>(() => warm?.district || null);
  const [loading, setLoading] = useState(() => !warm);
  const [error, setError] = useState<string | null>(null);

  const [serviceOptions, setServiceOptions] = useState<
    {value: string; label: string}[]
  >([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createPincode, setCreatePincode] = useState('');
  const [createService, setCreateService] = useState('');
  const [createExperience, setCreateExperience] = useState('');
  const [createRating, setCreateRating] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignProviderId, setAssignProviderId] = useState('');
  const [assignOptions, setAssignOptions] = useState<
    {value: string; label: string}[]
  >([]);
  const [assignProvidersById, setAssignProvidersById] = useState<
    Record<string, Provider>
  >({});
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  const load = useCallback(async (opts?: {force?: boolean}) => {
    if (!districtId) return;
    const force = opts?.force === true;
    if (force) clearGeographyListCache();
    const cached = !force ? peekGeographyProviders(districtId) : null;
    if (cached) {
      setRows(sortByUpdatedThenCreated(cached.providers));
      setServiceBreakdown(cached.serviceBreakdown || []);
      setDistrict(cached.district);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await getGeographyProviders(districtId, {force});
      setRows(sortByUpdatedThenCreated(result.providers));
      setServiceBreakdown(result.serviceBreakdown || []);
      setDistrict(result.district);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [districtId, t]);

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

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateName('');
    setCreatePhone('');
    setCreateAddress('');
    setCreatePincode('');
    setCreateService('');
    setCreateExperience('');
    setCreateRating('');
    setCreateError(null);
    setCreating(false);
  };

  const openCreate = () => {
    setCreateError(null);
    setCreatePincode(district?.pincode || '');
    setCreateOpen(true);
  };

  const closeAssign = () => {
    setAssignOpen(false);
    setAssignProviderId('');
    setAssignError(null);
    setAssigning(false);
  };

  const openAssign = async () => {
    setAssignOpen(true);
    setAssignError(null);
    setAssignProviderId('');
    setAssignLoading(true);
    try {
      const providers = await fetchProvidersForAssign();
      const inDistrict = new Set(rows.map((r) => r._id));
      const eligible = providers.filter((p) => !inDistrict.has(p._id));
      const byId: Record<string, Provider> = {};
      for (const p of eligible) byId[p._id] = p;
      setAssignProvidersById(byId);
      const options = eligible.map((p) => ({
        value: p._id,
        label: providerOptionLabel(p),
      }));
      setAssignOptions(options);
      if (!options.length) {
        setAssignError(t('geoNoProvidersToAssign'));
      }
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : t('errorGeneric'));
      setAssignOptions([]);
      setAssignProvidersById({});
    } finally {
      setAssignLoading(false);
    }
  };

  const onCreate = async () => {
    if (!districtId) return;
    setCreateError(null);
    const ten = localTenDigits(createPhone);
    if (!createName.trim()) {
      setCreateError(t('nameRequired'));
      return;
    }
    if (ten.length !== 10) {
      setCreateError(t('phoneTenDigits'));
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
      await createProviderInDistrict(
        districtId,
        {
          name: createName.trim(),
          phone: toE164(ten),
          serviceType: createService || undefined,
          address: createAddress.trim() || undefined,
          pincode: createPincode.trim() || undefined,
          experience: Number.isFinite(experience) ? experience : undefined,
          rating: Number.isFinite(rating) ? rating : undefined,
          onboardingSource: 'admin',
        },
        {stateId: district?.stateId},
      );
      closeCreate();
      await load({force: true});
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setCreating(false);
    }
  };

  const onAssign = async () => {
    if (!districtId || !assignProviderId) {
      setAssignError(t('geoSelectProvider'));
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      const prev = assignProvidersById[assignProviderId];
      await assignProviderToDistrict(districtId, assignProviderId, {
        stateId: district?.stateId,
        previousDistrictId: prev?.location?.districtId,
        previousStateId: prev?.location?.stateId,
      });
      closeAssign();
      await load({force: true});
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setAssigning(false);
    }
  };

  const columns = useMemo<VirtualTableColumn<GeographyProviderRow>[]>(
    () => [
      {
        key: 'name',
        header: t('name'),
        width: '18%',
        filterable: true,
        filterValue: (row) => row.name,
        render: (row) => (
          <Link to={`/providers/${row._id}`}>{row.name}</Link>
        ),
      },
      {
        key: 'phone',
        header: t('phone'),
        width: '14%',
        render: (row) => formatPhoneDisplay(row.phone || ''),
      },
      {
        key: 'service',
        header: t('services'),
        width: '18%',
        render: (row) => {
          const names = (row.services || [])
            .map((s) => s.name)
            .filter(Boolean);
          if (names.length) return names.join(', ');
          return row.serviceType || '—';
        },
      },
      {
        key: 'status',
        header: t('status'),
        width: '10%',
        render: (row) => row.approvalStatus || '—',
      },
      {
        key: 'jobs',
        header: t('geoColJobsCpc'),
        width: '16%',
        render: (row) => formatJobs(row.jobStats),
      },
      {
        key: 'rating',
        header: t('geoColAvgRating'),
        width: '10%',
        render: (row) =>
          row.rating ? Number(row.rating).toFixed(1) : t('geoNoRating'),
      },
      {
        key: 'reviews',
        header: t('geoColReviews'),
        width: '10%',
        render: (row) => String(row.totalReviews ?? 0),
      },
    ],
    [t],
  );

  return (
    <div
      className="admin-page scale-baseline-80"
      data-testid="geography-providers">
      <header className="page-header">
        <p className="muted compact">
          <Link to="/geography">{t('geoStatesTitle')}</Link>
          {district ? (
            <>
              {' / '}
              <Link to={`/geography/states/${district.stateId}`}>
                {district.stateName}
              </Link>
              {` / ${district.name}`}
            </>
          ) : null}
        </p>
        <h1>
          {t('geoProvidersTitle', {district: district?.name || '…'})}
        </h1>
        <p>{t('geoProvidersLead')}</p>
        {serviceBreakdown.length ? (
          <p className="muted compact">
            {t('geoServiceBreakdown')}:{' '}
            {serviceBreakdown
              .map((item) => `${item.service} ${item.count}`)
              .join(' · ')}
          </p>
        ) : null}
      </header>
      <div className="filter-row">
        {district ? (
          <Link
            className="hs-btn hs-btn--ghost hs-btn--md"
            to={`/geography/states/${district.stateId}`}>
            {t('back')}
          </Link>
        ) : (
          <Link className="hs-btn hs-btn--ghost hs-btn--md" to="/geography">
            {t('back')}
          </Link>
        )}
        <Button variant="primary" onClick={openCreate}>
          {t('geoAddProvider')}
        </Button>
        <Button variant="ghost" onClick={() => void openAssign()}>
          {t('geoAssignProvider')}
        </Button>
        <Button variant="ghost" onClick={() => void load({force: true})}
          disabled={loading}>
          {t('geoRefresh')}
        </Button>
      </div>
      <div className="panel">
        {error ? <p className="error-text">{error}</p> : null}
        <VirtualTable
          columns={columns}
          data={rows}
          rowKey={(row) => row._id}
          height={480}
          pageSize={50}
          emptyMessage={t('empty')}
          loading={loading}
          loadingMessage={t('loading')}
        />
      </div>

      {createOpen ? (
        <Dialog open
          title={t('geoAddProviderTitle')}
          onClose={closeCreate}
          testId="geo-create-provider-modal">
          <p className="muted compact">
            {t('geoAddProviderLead', {
              district: district?.name || '',
              state: district?.stateName || '',
            })}
          </p>
          <label>
            {t('geoState')}
            <input value={district?.stateName || ''} disabled readOnly />
          </label>
          <label>
            {t('geoDistrict')}
            <input value={district?.name || ''} disabled readOnly />
          </label>
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
            {t('pincode')}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={createPincode}
              onChange={(e) =>
                setCreatePincode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
            />
          </label>
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
          <div className="form-row">
            <label>
              {t('experienceOptional')}
              <input
                type="number"
                min={0}
                max={50}
                value={createExperience}
                onChange={(e) => setCreateExperience(e.target.value)}
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
              />
            </label>
          </div>
          {createError ? <p className="error-text">{createError}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={creating} onClick={() => void onCreate()}>
              {creating ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={closeCreate}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {assignOpen ? (
        <Dialog open
          title={t('geoAssignProviderTitle')}
          onClose={closeAssign}
          testId="geo-assign-provider-modal">
          <p className="muted compact">
            {t('geoAssignProviderLead', {
              district: district?.name || '',
              state: district?.stateName || '',
            })}
          </p>
          <label>
            {t('geoSelectProvider')}
            <Select
              options={assignOptions}
              value={assignProviderId}
              placeholder={
                assignLoading ? t('loading') : t('geoSelectProvider')
              }
              showSearch
              disabled={assignLoading}
              onChange={setAssignProviderId}
            />
          </label>
          {assignError ? <p className="error-text">{assignError}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={assigning || assignLoading || !assignProviderId} onClick={() => void onAssign()}>
              {assigning ? t('saving') : t('geoAssignProvider')}
            </Button>
            <Button variant="ghost" onClick={closeAssign}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
