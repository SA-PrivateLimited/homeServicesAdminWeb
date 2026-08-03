import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Icon, Select} from 'sapvt-ltd-web-packages';
import {Modal} from '../components/Modal';
import {SuccessBanner, type SuccessBannerContent} from '../components/SuccessBanner';
import {
  getProviderById,
  resolveUploadUrl,
  updateProvider,
  uploadProviderDocument,
  type Provider,
  type ProviderDocKey,
} from '../services/api/providersApi';
import {
  getJobCardsPage,
  type JobCard,
  type JobComment,
} from '../services/api/jobCardsApi';
import {getServiceCategories} from '../services/api/serviceCategoriesApi';
import {
  getGeographyMeta,
  invalidateGeographyListCache,
  type GeographyMetaDistrict,
  type GeographyMetaState,
} from '../services/api/geographyApi';
import {
  formatPhoneDisplay,
  localTenDigits,
  toE164,
} from '../utils/phone';
import '../styles/pages.css';

const DOC_KEYS: ProviderDocKey[] = ['idProof', 'addressProof', 'certificate'];

function pickProviderAddress(data: Provider): {
  address: string;
  pincode: string;
  city: string;
  state: string;
  district: string;
  stateId: string;
  districtId: string;
} {
  const loc = data.location;
  const addrField = data.address;
  const current = data.currentLocation;

  let address = '';
  if (typeof addrField === 'string') {
    address = addrField.trim();
  } else if (addrField && typeof addrField === 'object') {
    address = (addrField.address || '').trim();
  }
  if (!address && loc?.address) address = String(loc.address).trim();
  if (!address && current?.address) address = String(current.address).trim();

  const pincode =
    (loc?.pincode ||
      (typeof addrField === 'object' ? addrField?.pincode : '') ||
      current?.pincode ||
      '') + '';

  return {
    address,
    pincode: pincode.trim(),
    city: (loc?.city || current?.city || '').trim(),
    state: (loc?.state || current?.state || '').trim(),
    district: (loc?.district || '').trim(),
    stateId: (loc?.stateId || '').trim(),
    districtId: (loc?.districtId || '').trim(),
  };
}

function commentIcon(role: JobComment['role']): string {
  if (role === 'customer') return 'person';
  if (role === 'provider') return 'engineering';
  return 'admin_panel_settings';
}

export function ProviderDetailPage() {
  const {providerId} = useParams();
  const {t} = useTranslation();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadBusyKey, setUploadBusyKey] = useState<ProviderDocKey | null>(
    null,
  );
  const [docReject, setDocReject] = useState<ProviderDocKey | null>(null);
  const [docRejectReason, setDocRejectReason] = useState('');
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);
  const [serviceOptions, setServiceOptions] = useState<
    {value: string; label: string}[]
  >([]);
  const [jobFeedback, setJobFeedback] = useState<
    {job: JobCard; comments: JobComment[]}[]
  >([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [serviceType, setServiceType] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [pendingStateName, setPendingStateName] = useState('');
  const [pendingDistrictName, setPendingDistrictName] = useState('');
  const [geoStates, setGeoStates] = useState<GeographyMetaState[]>([]);
  const [geoDistricts, setGeoDistricts] = useState<GeographyMetaDistrict[]>(
    [],
  );
  const [experience, setExperience] = useState('');
  const [rating, setRating] = useState('');
  const [serviceFee, setServiceFee] = useState(0);

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProviderById(providerId);
      if (!data) {
        setError(t('notFound'));
        setProvider(null);
        return;
      }
      setProvider(data);
      setName(data.name || data.displayName || data.businessName || '');
      setPhone(localTenDigits(data.phone || data.phoneNumber || ''));
      setPhoneVerified(Boolean(data.phoneVerified));
      setServiceType(data.serviceType || data.specialization || '');
      const {
        address: addr,
        pincode: pin,
        city: cityVal,
        state: stateName,
        district: districtName,
        stateId: sid,
        districtId: did,
      } = pickProviderAddress(data);
      setAddress(addr);
      setPincode(pin);
      setCity(cityVal || districtName);
      setStateId(sid);
      setDistrictId(did);
      setPendingStateName(!sid ? stateName : '');
      setPendingDistrictName(!did ? districtName : '');
      setExperience(
        data.experience != null && data.experience !== undefined
          ? String(data.experience)
          : '',
      );
      setRating(
        data.rating != null && data.rating !== undefined
          ? String(data.rating)
          : '',
      );
      setServiceFee(data.serviceFee || 0);

      const jobsPage = await getJobCardsPage({
        providerId,
        limit: 50,
        offset: 0,
      });
      setJobFeedback(
        jobsPage.items
          .map((job) => ({
            job,
            comments: (job.comments || []).filter((c) => c.role === 'customer'),
          }))
          .filter((entry) => entry.comments.length > 0),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [providerId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void getServiceCategories(false)
      .then((cats) => {
        const opts = cats
          .filter((c) => c.isActive !== false)
          .map((c) => ({value: c.name, label: c.name}));
        setServiceOptions(opts);
      })
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

  useEffect(() => {
    if (!geoStates.length) return;
    if (!stateId && pendingStateName) {
      const match = geoStates.find(
        (s) => s.name.toLowerCase() === pendingStateName.toLowerCase(),
      );
      if (match) setStateId(match._id);
    }
  }, [geoStates, pendingStateName, stateId]);

  useEffect(() => {
    if (!geoDistricts.length) return;
    if (!districtId && pendingDistrictName) {
      const match = geoDistricts.find(
        (d) =>
          d.name.toLowerCase() === pendingDistrictName.toLowerCase() &&
          (!stateId || d.stateId === stateId),
      );
      if (match) {
        setDistrictId(match._id);
        if (!stateId) setStateId(match.stateId);
      }
    }
  }, [geoDistricts, pendingDistrictName, districtId, stateId]);

  const stateOptions = useMemo(
    () => geoStates.map((s) => ({value: s._id, label: s.name})),
    [geoStates],
  );

  const districtOptions = useMemo(
    () =>
      geoDistricts
        .filter((d) => !stateId || d.stateId === stateId)
        .map((d) => ({value: d._id, label: d.name})),
    [geoDistricts, stateId],
  );

  useEffect(() => {
    if (!successBanner) return;
    const timer = window.setTimeout(() => setSuccessBanner(null), 10000);
    return () => window.clearTimeout(timer);
  }, [successBanner]);

  const categoryOptions = useMemo(() => {
    if (serviceType && !serviceOptions.some((o) => o.value === serviceType)) {
      return [{value: serviceType, label: serviceType}, ...serviceOptions];
    }
    return serviceOptions;
  }, [serviceOptions, serviceType]);

  const onSave = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!providerId) return;
    const ten = localTenDigits(phone);
    if (ten && ten.length !== 10) {
      setError(t('phoneTenDigits'));
      return;
    }
    if (!serviceType) {
      setError(t('serviceRequired'));
      return;
    }
    if (!stateId) {
      setError(t('geoStateRequired'));
      return;
    }
    if (!districtId) {
      setError(t('geoDistrictRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const exp = experience.trim() === '' ? undefined : Number(experience);
      const rate = rating.trim() === '' ? undefined : Number(rating);
      const selectedState = geoStates.find((s) => s._id === stateId);
      const selectedDistrict = geoDistricts.find((d) => d._id === districtId);
      const districtName = selectedDistrict?.name || '';
      const previousDistrictId = provider?.location?.districtId;
      const previousStateId = provider?.location?.stateId;
      await updateProvider(providerId, {
        name,
        phone: ten ? toE164(ten) : '',
        phoneNumber: ten ? toE164(ten) : '',
        phoneVerified,
        serviceType,
        specialization: serviceType,
        serviceCategories: serviceType ? [serviceType] : [],
        experience: Number.isFinite(exp) ? exp : undefined,
        rating: Number.isFinite(rate) ? rate : undefined,
        serviceFee,
        location: {
          address: address.trim() || undefined,
          pincode: pincode.trim() || undefined,
          city: city.trim() || districtName || undefined,
          state: selectedState?.name || undefined,
          district: districtName || undefined,
          stateId: stateId || undefined,
          districtId: districtId || undefined,
        },
      });
      invalidateGeographyListCache({
        districtId,
        stateId,
        previousDistrictId,
        previousStateId,
      });
      await load();
      setSuccessBanner({
        title: t('providerSavedTitle'),
        detail: t('providerSavedDetail'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const mergeDocuments = (patch: Record<string, unknown>) => ({
    ...(provider?.documents || {}),
    ...patch,
  });

  const verifyDoc = async (key: ProviderDocKey) => {
    if (!providerId || !provider) return;
    setSaving(true);
    setError(null);
    try {
      await updateProvider(providerId, {
        documents: mergeDocuments({
          [`${key}Verified`]: true,
          [`${key}Rejected`]: false,
          [`${key}RejectionReason`]: '',
        }),
      } as Partial<Provider>);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const rejectDoc = async () => {
    if (!providerId || !provider || !docReject || !docRejectReason.trim()) {
      setError(t('rejectionRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const key = docReject;
      await updateProvider(providerId, {
        documents: mergeDocuments({
          [`${key}Verified`]: false,
          [`${key}Rejected`]: true,
          [`${key}RejectionReason`]: docRejectReason.trim(),
        }),
      } as Partial<Provider>);
      setDocReject(null);
      setDocRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const onUploadDoc = async (key: ProviderDocKey, file: File | undefined) => {
    if (!providerId || !file) return;
    setUploadBusyKey(key);
    setError(null);
    try {
      await uploadProviderDocument(providerId, key, file);
      await load();
      setSuccessBanner({
        title: t('documentUploadedTitle'),
        detail: t('documentUploadedDetail', {doc: key}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setUploadBusyKey(null);
      const input = fileInputRefs.current[key];
      if (input) input.value = '';
    }
  };

  if (loading) return <p className="muted">{t('loading')}</p>;
  if (!provider) {
    return (
      <div>
        <p className="error-text">{error || t('notFound')}</p>
        <Link className="btn btn-ghost icon-only" to="/providers" aria-label={t('back')}>
          <Icon name="arrow_back" size={20} />
        </Link>
      </div>
    );
  }

  const status = provider.approvalStatus || provider.status || 'pending';

  return (
    <div
      className="admin-page scale-baseline-80"
      data-testid="provider-detail-root">
      <header className="page-header detail-header">
        <div className="detail-header-left">
          <Link
            className="btn btn-ghost icon-only detail-back"
            to="/providers"
            aria-label={t('back')}
            title={t('back')}>
            <Icon name="arrow_back" size={22} />
          </Link>
          <div>
            <p className="breadcrumb">
              <Link to="/providers">{t('navProviders')}</Link> /{' '}
              {name || provider._id}
            </p>
            <h1>{t('providerDetails')}</h1>
            <p>
              Status: <span className={`badge badge-${status}`}>{status}</span>
              {provider.isActive === false ? (
                <>
                  {' '}
                  <span className="badge badge-rejected">{t('inactive')}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="detail-header-actions">
          <Link className="btn btn-ghost detail-close" to="/providers">
            {t('close')}
          </Link>
          <button
            type="submit"
            form="provider-edit-form"
            className="btn btn-primary detail-save"
            disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="provider-detail-banner"
        />
      ) : null}

      <div className="panel form-panel">
        <h3>{t('documents')}</h3>
        <ul className="doc-list interactive-list">
          {DOC_KEYS.map((key) => {
            const docs = provider.documents || {};
            const rawUrl = docs[key];
            const url =
              typeof rawUrl === 'string'
                ? resolveUploadUrl(rawUrl)
                : undefined;
            const verified = Boolean(docs[`${key}Verified`]);
            const rejected = Boolean(docs[`${key}Rejected`]);
            const reason = docs[`${key}RejectionReason`];
            return (
              <li key={key}>
                <div className="doc-row">
                  <div>
                    <strong>{key}</strong>{' '}
                    {verified ? (
                      <span className="badge badge-approved">verified</span>
                    ) : null}
                    {rejected ? (
                      <span className="badge badge-rejected">rejected</span>
                    ) : null}
                    {typeof reason === 'string' && reason ? (
                      <p className="muted compact">{reason}</p>
                    ) : null}
                  </div>
                  <div className="actions">
                    {url ? (
                      <a
                        className="btn btn-ghost"
                        href={url}
                        target="_blank"
                        rel="noreferrer">
                        {t('open')}
                      </a>
                    ) : (
                      <span className="muted compact">—</span>
                    )}
                    <input
                      ref={(el) => {
                        fileInputRefs.current[key] = el;
                      }}
                      type="file"
                      accept="image/*,application/pdf"
                      className="visually-hidden"
                      onChange={(e) =>
                        void onUploadDoc(key, e.target.files?.[0])
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={uploadBusyKey === key}
                      onClick={() => fileInputRefs.current[key]?.click()}>
                      <Icon name="upload" size={16} />
                      {uploadBusyKey === key
                        ? t('uploading')
                        : t('uploadDocument')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving || !url}
                      onClick={() => void verifyDoc(key)}>
                      {t('verify')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={saving || !url}
                      onClick={() => {
                        setDocReject(key);
                        setDocRejectReason('');
                      }}>
                      {t('reject')}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <form
        id="provider-edit-form"
        className="panel form-panel panel-spaced-top"
        onSubmit={(e) => void onSave(e)}>
        <div className="form-row">
          <label>
            {t('name')}
            <input value={name} onChange={(e) => setName(e.target.value)} />
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
                value={phone}
                placeholder={t('phoneTenDigitsHint')}
                onChange={(e) =>
                  setPhone(localTenDigits(e.target.value).slice(0, 10))
                }
              />
            </div>
            {phone ? (
              <span className="muted compact">
                Preview: {formatPhoneDisplay(toE164(phone))}
              </span>
            ) : null}
            <label className="checkbox-inline" style={{marginTop: 8}}>
              <input
                type="checkbox"
                checked={phoneVerified}
                onChange={(e) => setPhoneVerified(e.target.checked)}
              />
              {t('markPhoneVerified')}
            </label>
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('locationAddress')}
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('addressPlaceholder')}
            />
          </label>
          <label>
            {t('pincode')}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) =>
                setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('geoState')}
            <Select
              options={stateOptions}
              value={stateId}
              placeholder={t('geoState')}
              showSearch
              onChange={(value) => {
                setStateId(value);
                setDistrictId('');
                setPendingStateName('');
                setPendingDistrictName('');
                setPincode('');
              }}
            />
          </label>
          <label>
            {t('geoDistrict')}
            <Select
              options={districtOptions}
              value={districtId}
              placeholder={t('geoDistrict')}
              showSearch
              onChange={(value) => {
                setDistrictId(value);
                setPendingDistrictName('');
                const d = geoDistricts.find((x) => x._id === value);
                if (d) {
                  if (!city.trim()) setCity(d.name);
                  if (d.pincode) setPincode(d.pincode);
                }
              }}
            />
          </label>
          <label>
            {t('geoCity')}
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t('geoDistrict')}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('serviceType')}
            <Select
              options={categoryOptions}
              value={serviceType}
              placeholder={t('selectServiceType')}
              showSearch
              onChange={setServiceType}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('experienceOptional')}
            <input
              type="number"
              min={0}
              max={50}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            />
          </label>
          <label>
            {t('ratingOptional')}
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
          </label>
          <label>
            Service fee
            <input
              type="number"
              value={serviceFee}
              onChange={(e) => setServiceFee(Number(e.target.value))}
            />
          </label>
        </div>
      </form>

      <div className="panel form-panel panel-spaced-top">
        <h3>
          <Icon name="chat" size={18} /> {t('customerJobFeedback')}
        </h3>
        <p className="muted compact">{t('customerJobFeedbackLead')}</p>
        {jobFeedback.length === 0 ? (
          <p className="muted">{t('noCustomerFeedback')}</p>
        ) : (
          <ul className="interactive-list feedback-list">
            {jobFeedback.map(({job, comments}) => (
              <li key={job._id}>
                <div className="feedback-job-meta">
                  <strong>{job.serviceType || 'Job'}</strong>
                  <span className="muted compact">
                    {job.customerName || job.customerId || '—'} ·{' '}
                    {job.status || '—'}
                  </span>
                </div>
                <ul className="job-comment-list">
                  {comments.map((c) => (
                    <li
                      key={c._id}
                      className={`job-comment job-comment--${c.role}`}>
                      <span className="job-comment-meta">
                        <Icon name={commentIcon(c.role)} size={14} />
                        <span className="job-comment-role">
                          {c.authorName || t('commentRoleCustomer')}
                        </span>
                      </span>
                      <p className="job-comment-text">{c.text}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {docReject ? (
        <Modal
          title={`${t('reject')} ${docReject}`}
          onClose={() => setDocReject(null)}>
          <label>
            {t('rejectionReason')}
            <textarea
              rows={3}
              value={docRejectReason}
              onChange={(e) => setDocRejectReason(e.target.value)}
              autoFocus
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={saving}
              onClick={() => void rejectDoc()}>
              {t('reject')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDocReject(null)}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
