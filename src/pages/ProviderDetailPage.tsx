import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  Icon,
  Select,
  Button,
  Dialog,
  ErrorState,
  Loader,
  StatusChip,
} from 'sapvt-ltd-web-packages';
import {SuccessBanner, pinSuccessBanner, type SuccessBannerContent} from '../components/SuccessBanner';
import {RoleBadges} from '../components/RoleBadges';
import {
  addProviderService,
  getProviderById,
  resolveUploadUrl,
  updateProvider,
  updateProviderServiceProfile,
  updateProviderServiceQualification,
  uploadProviderDocument,
  type Provider,
  type ProviderDocKey,
  type ProviderServiceQualification,
} from '../services/api/providersApi';
import {
  deactivateUser,
  restoreUser,
  setUserPin,
} from '../services/api/usersApi';
import {
  getJobCardsPage,
  type JobCard,
  type JobComment,
} from '../services/api/jobCardsApi';
import {getServiceCategories} from '../services/api/serviceCategoriesApi';
import type {ServiceCategory} from '../services/api/serviceCategoriesApi';
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

const ACCOUNT_DOC_KEYS: ProviderDocKey[] = ['idProof', 'addressProof'];

function serviceInformationOf(
  q: ProviderServiceQualification | null | undefined,
): string {
  const raw = q?.serviceInfo;
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object') {
    const text = (raw as Record<string, unknown>).text;
    if (typeof text === 'string') return text.trim();
    const description = (raw as Record<string, unknown>).description;
    if (typeof description === 'string') return description.trim();
  }
  return String(q?.notes || '').trim();
}

function requiredServiceDocuments(
  categories: ServiceCategory[],
  serviceName: string,
): Array<{key: string; label: string; required: boolean}> {
  const category = categories.find(
    (c) => c.name.trim().toLowerCase() === serviceName.trim().toLowerCase(),
  );
  const docs = Array.isArray(category?.partnerDocuments)
    ? category.partnerDocuments.filter((d) => d?.key)
    : [];
  if (docs.length) {
    return docs.map((d) => ({
      key: String(d.key),
      label: d.label || String(d.key),
      required: d.required !== false,
    }));
  }
  return [
    {key: 'certificate', label: 'Certificate / License', required: true},
    {key: 'experienceProof', label: 'Experience Certificate', required: false},
  ];
}

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

function partnerServiceNames(p: Provider | null): string[] {
  if (!p) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw?: string) => {
    const s = String(raw || '').trim();
    const key = s.toLowerCase();
    if (!s || seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  add(p.serviceType);
  add(p.specialization);
  (p.serviceCategories || []).forEach(add);
  (p.serviceQualifications || []).forEach((q) => add(q.name));
  return out;
}

function serviceQualificationOf(p: Provider | null, name: string) {
  const matches = (p?.serviceQualifications || []).filter(
    (q) => String(q.name || '').toLowerCase() === name.toLowerCase(),
  );
  if (!matches.length) return undefined;
  return [...matches].sort((a, b) => {
    const aTime = new Date(
      (a as {updatedAt?: string; reviewedAt?: string; submittedAt?: string}).updatedAt ||
        (a as {reviewedAt?: string}).reviewedAt ||
        (a as {submittedAt?: string}).submittedAt ||
        0,
    ).getTime();
    const bTime = new Date(
      (b as {updatedAt?: string; reviewedAt?: string; submittedAt?: string}).updatedAt ||
        (b as {reviewedAt?: string}).reviewedAt ||
        (b as {submittedAt?: string}).submittedAt ||
        0,
    ).getTime();
    return bTime - aTime;
  })[0];
}

function serviceVerificationOf(p: Provider | null, name: string): string {
  const found = serviceQualificationOf(p, name);
  const status = String(found?.verificationStatus || '').toLowerCase();
  if (status === 'approved' || status === 'required' || status === 'rejected') {
    return status;
  }
  if (status === 'pending') {
    return found?.submittedAt ? 'pending' : 'required';
  }
  const account = String(p?.approvalStatus || '').toLowerCase();
  if (account === 'rejected') return 'rejected';
  if (account === 'pending') return 'pending';
  return 'approved';
}

function isPartnerServiceActive(p: Provider | null, name: string): boolean {
  const inactive = (p?.inactiveServiceCategories || []).map((s) =>
    String(s).toLowerCase(),
  );
  return !inactive.includes(name.toLowerCase());
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
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
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
  const [serviceBusy, setServiceBusy] = useState(false);
  const [reviewService, setReviewService] = useState<string | null>(null);
  const [serviceRejectReason, setServiceRejectReason] = useState('');
  const [manageService, setManageService] = useState<string | null>(null);
  const [manageExperience, setManageExperience] = useState('');
  const [manageNotes, setManageNotes] = useState('');
  const [manageBusy, setManageBusy] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageUploadBusyKey, setManageUploadBusyKey] = useState<string | null>(null);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

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
        setServiceCategories(cats);
        const opts = cats
          .filter((c) => c.isActive !== false)
          .map((c) => ({value: c.name, label: c.name}));
        setServiceOptions(opts);
      })
      .catch(() => {
        setServiceCategories([]);
        setServiceOptions([]);
      });
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

  const listedServices = useMemo(
    () => partnerServiceNames(provider),
    [provider],
  );

  const onAddPartnerService = async (serviceName: string) => {
    const name = String(serviceName || '').trim();
    if (!providerId || !name) return;
    setServiceBusy(true);
    setError(null);
    try {
      const updated = await addProviderService(providerId, name);
      setProvider(updated);
      setAddServiceOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setServiceBusy(false);
    }
  };

  const onResetPartnerPin = async () => {
    if (!providerId) return;
    setPinBusy(true);
    setPinMessage(null);
    try {
      const result = await setUserPin(
        providerId,
        pinValue.trim() || undefined,
        'partner',
      );
      setPinOpen(false);
      setPinValue('');
      setSuccessBanner(
        pinSuccessBanner(
          t,
          {name, phone: provider?.phone || provider?.phoneNumber},
          result.loginPin,
        ),
      );
    } catch (err) {
      setPinMessage(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setPinBusy(false);
    }
  };

  const onDeactivatePartner = async () => {
    if (!providerId) return;
    if (!deactivateReason.trim()) {
      setDeactivateError(t('deactivationReasonRequired'));
      return;
    }
    setDeactivateBusy(true);
    setDeactivateError(null);
    try {
      await deactivateUser(providerId, deactivateReason.trim(), 'partner');
      setDeactivateOpen(false);
      setDeactivateReason('');
      await load();
      setSuccessBanner({
        title: t('partnerAccessDeactivatedTitle'),
        detail: t('partnerAccessDeactivatedDetail', {name}),
      });
    } catch (err) {
      setDeactivateError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setDeactivateBusy(false);
    }
  };

  const onRestorePartner = async () => {
    if (!providerId) return;
    setRestoreBusy(true);
    setError(null);
    try {
      await restoreUser(providerId, 'partner');
      await load();
      setSuccessBanner({
        title: t('partnerAccessRestoredTitle'),
        detail: t('partnerAccessRestoredDetail', {name}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setRestoreBusy(false);
    }
  };

  const onChangeServiceVerification = async (
    serviceName: string,
    verificationStatus: 'approved' | 'pending' | 'required' | 'rejected',
    rejectionReason?: string,
  ) => {
    if (!providerId) return;
    if (verificationStatus === 'rejected' && !String(rejectionReason || '').trim()) {
      setError(t('rejectionRequired'));
      return;
    }
    setServiceBusy(true);
    setError(null);
    try {
      const updated = await updateProviderServiceQualification(
        providerId,
        serviceName,
        verificationStatus,
        rejectionReason,
      );
      setProvider(updated);
      setReviewService(null);
      setServiceRejectReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setServiceBusy(false);
    }
  };

  const openManageService = (svcName: string) => {
    const qual = serviceQualificationOf(provider, svcName);
    setManageService(svcName);
    setManageExperience(qual?.experience != null ? String(qual.experience) : '');
    setManageNotes(serviceInformationOf(qual));
    setManageError(null);
  };

  const onSaveServiceProfile = async () => {
    if (!providerId || !manageService) return;
    setManageBusy(true);
    setManageError(null);
    try {
      const expNum =
        manageExperience.trim() === '' ? null : Number(manageExperience);
      const updated = await updateProviderServiceProfile(providerId, manageService, {
        experience: expNum,
        notes: manageNotes.trim(),
        serviceInfo: manageNotes.trim(),
      });
      setProvider(updated);
      setManageService(null);
      setSuccessBanner({
        title: t('serviceSavedTitle'),
        detail: t('serviceSavedDetail', {service: manageService}),
      });
    } catch (err) {
      setManageError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setManageBusy(false);
    }
  };

  const onUploadServiceDoc = async (docKey: string, file: File | undefined) => {
    if (!providerId || !manageService || !file) return;
    setManageUploadBusyKey(docKey);
    setManageError(null);
    try {
      const result = await uploadProviderDocument(
        providerId,
        docKey,
        file,
        manageService,
      );
      if (result.provider) {
        setProvider(result.provider);
      } else {
        await load();
      }
      setSuccessBanner({
        title: t('documentUploadedTitle'),
        detail: t('documentUploadedDetail', {doc: docKey}),
      });
    } catch (err) {
      setManageError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setManageUploadBusyKey(null);
      const input = fileInputRefs.current[`service:${manageService}:${docKey}`];
      if (input) input.value = '';
    }
  };

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

  if (loading) return <Loader label={t('loading')} />;
  if (!provider) {
    return (
      <ErrorState
        title={t('notFound')}
        message={error || undefined}
        retryLabel={t('back')}
        onRetry={() => {
          window.location.assign('/providers');
        }}
      />
    );
  }

  const status = provider.approvalStatus || provider.status || 'pending';
  const reviewQual = reviewService
    ? serviceQualificationOf(provider, reviewService)
    : null;
  const manageQual = manageService
    ? serviceQualificationOf(provider, manageService)
    : null;
  const manageRequiredDocs = manageService
    ? requiredServiceDocuments(serviceCategories, manageService)
    : [];
  const reviewRequiredDocs = reviewService
    ? requiredServiceDocuments(serviceCategories, reviewService)
    : [];

  return (
    <div
      className="admin-page scale-baseline-80"
      data-testid="provider-detail-root">
      <header className="page-header detail-header">
        <div className="detail-header-left">
          <Link
            className="hs-btn hs-btn--ghost hs-btn--md icon-only detail-back"
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
              Status: <StatusChip status={status} label={status} />
              {provider.isActive === false ? (
                <>
                  {' '}
                  <StatusChip status="cancelled" label={t('inactive')} />
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="detail-header-actions">
          <Link className="hs-btn hs-btn--ghost hs-btn--md detail-close" to="/providers">
            {t('close')}
          </Link>
          <Button
            type="submit"
            form="provider-edit-form"
            variant="primary"
            className="detail-save"
            loading={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
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
        <h3>{t('partnerAccount')}</h3>
        <div className="name-with-roles">
          <strong>{name || provider.displayName || provider._id}</strong>
          <RoleBadges
            hasPartner
            hasCustomer={Boolean(provider.hasCustomerProfile)}
          />
        </div>
        <dl className="detail-list">
          <div>
            <dt>{t('phone')}</dt>
            <dd>
              {formatPhoneDisplay(provider.phone, provider.phoneNumber)}{' '}
              {provider.phoneVerified ? (
                <StatusChip status="completed" label={t('phoneVerified')} />
              ) : (
                <StatusChip status="cancelled" label={t('phoneUnverified')} />
              )}
            </dd>
          </div>
          <div>
            <dt>{t('accountStatus')}</dt>
            <dd>
              <StatusChip status={status} label={status} />
            </dd>
          </div>
          <div>
            <dt>{t('access')}</dt>
            <dd>
              {provider.isActive === false ? (
                <StatusChip status="cancelled" label={t('inactive')} />
              ) : (
                <StatusChip status="active" label={t('active')} />
              )}
            </dd>
          </div>
          <div>
            <dt>{t('partnerLoginPin')}</dt>
            <dd>{provider.hasPin ? '••••••' : '—'}</dd>
          </div>
        </dl>
        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setPinOpen(true);
              setPinValue('');
              setPinMessage(null);
            }}>
            {t('resetPartnerPin')}
          </Button>
          {provider.isActive === false ? (
            <Button
              variant="secondary"
              disabled={restoreBusy}
              onClick={() => void onRestorePartner()}>
              {t('restorePartnerAccess')}
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => {
                setDeactivateOpen(true);
                setDeactivateReason('');
                setDeactivateError(null);
              }}>
              {t('deactivatePartnerAccess')}
            </Button>
          )}
        </div>
        {provider.hasCustomerProfile ? (
          <p className="muted compact also-registered">
            {t('alsoRegisteredAsCustomer')}
          </p>
        ) : null}
      </div>

      <div className="panel form-panel panel-spaced-top">
        <h3>{t('accountVerification')}</h3>
        <ul className="doc-list interactive-list">
          {ACCOUNT_DOC_KEYS.map((key) => {
            const docs = provider.documents || {};
            const rawUrl = docs[key];
            const url =
              typeof rawUrl === 'string'
                ? resolveUploadUrl(rawUrl)
                : undefined;
            const verified = Boolean(docs[`${key}Verified`]);
            const rejected = Boolean(docs[`${key}Rejected`]);
            const reason = docs[`${key}RejectionReason`];
            const label =
              key === 'idProof' ? t('identityProof') : t('addressProof');
            return (
              <li key={key}>
                <div className="doc-row">
                  <div>
                    <strong>{label}</strong>{' '}
                    {verified ? (
                      <StatusChip status="completed" label={t('serviceVerified')} />
                    ) : null}
                    {rejected ? (
                      <StatusChip status="cancelled" label="rejected" />
                    ) : null}
                    {typeof reason === 'string' && reason ? (
                      <p className="muted compact">{reason}</p>
                    ) : null}
                  </div>
                  <div className="actions">
                    {url ? (
                      <a
                        className="hs-btn hs-btn--ghost hs-btn--md"
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
                    <Button variant="ghost" disabled={uploadBusyKey === key} onClick={() => fileInputRefs.current[key]?.click()}>
                      <Icon name="upload" size={16} />
                      {uploadBusyKey === key
                        ? t('uploading')
                        : t('uploadDocument')}
                    </Button>
                    <Button variant="primary" disabled={saving || !url} onClick={() => void verifyDoc(key)}>
                      {t('verify')}
                    </Button>
                    <Button variant="danger" disabled={saving || !url} onClick={() => {
                        setDocReject(key);
                        setDocRejectReason('');
                      }}>
                      {t('reject')}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
          <li>
            <div className="doc-row">
              <div>
                <strong>{t('phone')}</strong>{' '}
                {provider.phoneVerified ? (
                  <StatusChip status="completed" label={t('serviceVerified')} />
                ) : (
                  <StatusChip status="cancelled" label={t('phoneUnverified')} />
                )}
              </div>
            </div>
          </li>
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
        <div className="section-header-row">
          <h3>
            <Icon name="handyman" size={18} /> {t('partnerServices')}
          </h3>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAddServiceOpen(true)}>
            {t('addPartnerService')}
          </Button>
        </div>
        <p className="muted compact">{t('partnerServicesLead')}</p>
        {listedServices.length === 0 ? (
          <p className="muted">{t('partnerServicesEmpty')}</p>
        ) : (
          <ul className="interactive-list">
            {listedServices.map((svcName) => {
              const status = serviceVerificationOf(provider, svcName);
              const isPrimary =
                svcName.toLowerCase() ===
                (provider?.serviceType || serviceType).toLowerCase();
              const active = isPartnerServiceActive(provider, svcName);
              const qualification = serviceQualificationOf(provider, svcName);
              const statusLabel =
                status === 'approved'
                  ? t('serviceVerified')
                  : status === 'rejected'
                    ? t('serviceRejected')
                    : status === 'required'
                      ? t('serviceRequiredStatus')
                      : t('servicePending');
              return (
                <li key={svcName} className="partner-service-row">
                  <div className="feedback-job-meta">
                    <strong>
                      {svcName}
                      {isPrimary ? ` · ${t('primaryService')}` : ''}
                    </strong>
                    <p className="muted compact">
                      {statusLabel}
                      {' · '}
                      {active
                        ? t('serviceAvailabilityOn')
                        : t('serviceAvailabilityOff')}
                    </p>
                    {qualification?.experience != null ? (
                      <p className="muted compact">
                        {t('experience')}: {qualification.experience} {t('years')}
                      </p>
                    ) : null}
                    {serviceInformationOf(qualification) ? (
                      <p className="muted compact">
                        {t('serviceInformation')}: {serviceInformationOf(qualification)}
                      </p>
                    ) : null}
                    {status === 'rejected' && qualification?.rejectionReason ? (
                      <p className="muted compact">
                        {t('rejectionReason')}: {qualification.rejectionReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="service-row-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={serviceBusy}
                      onClick={() => openManageService(svcName)}>
                      {t('manageService')}
                    </Button>
                    <Button
                      type="button"
                      variant={status === 'approved' ? 'ghost' : 'primary'}
                      disabled={serviceBusy}
                      onClick={() => {
                        setReviewService(svcName);
                        setServiceRejectReason(qualification?.rejectionReason || '');
                        setError(null);
                      }}>
                      {status === 'approved'
                        ? t('reviewVerification')
                        : t('reviewVerification')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

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

      {reviewService ? (
        <Dialog
          open
          title={t('reviewServiceTitle', {service: reviewService})}
          onClose={() => setReviewService(null)}>
          <dl className="detail-list service-review-details">
            <div>
              <dt>{t('partner')}</dt>
              <dd>{name || provider.displayName || provider._id}</dd>
            </div>
            <div>
              <dt>{t('service')}</dt>
              <dd>{reviewService}</dd>
            </div>
            <div>
              <dt>{t('accountStatus')}</dt>
              <dd>{status}</dd>
            </div>
            <div>
              <dt>{t('experience')}</dt>
              <dd>
                {reviewQual?.experience != null
                  ? `${reviewQual.experience} ${t('years')}`
                  : <span className="muted">{t('notProvided')}</span>}
              </dd>
            </div>
            <div>
              <dt>{t('serviceInformation')}</dt>
              <dd>
                {serviceInformationOf(reviewQual)
                  ? serviceInformationOf(reviewQual)
                  : <span className="muted">{t('notProvided')}</span>}
              </dd>
            </div>
            <div>
              <dt>{t('serviceDocuments')}</dt>
              <dd>
                {reviewRequiredDocs.length ? (
                  <ul className="service-review-docs">
                    {reviewRequiredDocs.map((requiredDoc) => {
                      const doc = reviewQual?.documents?.find(
                        (item) => String(item.key || '') === requiredDoc.key,
                      );
                      const url = resolveUploadUrl(doc?.url);
                      return (
                        <li key={requiredDoc.key}>
                          <span>{requiredDoc.label}</span>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer">
                              {doc?.fileName || t('open')}
                            </a>
                          ) : (
                            <span className="muted">{t('notProvided')}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <span className="muted">{t('notProvided')}</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="modal-form">
            <label>
              {t('rejectionReason')}
              <textarea
                rows={3}
                value={serviceRejectReason}
                onChange={(e) => setServiceRejectReason(e.target.value)}
              />
            </label>
          </div>
          <div className="modal-actions">
            <Button
              variant="primary"
              disabled={serviceBusy}
              loading={serviceBusy}
              onClick={() =>
                void onChangeServiceVerification(reviewService, 'approved')
              }>
              {t('approveService', {service: reviewService})}
            </Button>
            <Button
              variant="danger"
              disabled={serviceBusy}
              onClick={() =>
                void onChangeServiceVerification(
                  reviewService,
                  'rejected',
                  serviceRejectReason,
                )
              }>
              {t('reject')}
            </Button>
            <Button variant="ghost" onClick={() => setReviewService(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {manageService ? (
        <Dialog
          open
          title={t('manageServiceTitle', {service: manageService})}
          onClose={() => setManageService(null)}>
          <p className="modal-lead">
            {t('manageServiceLead', {service: manageService})}
          </p>
          <div className="modal-form">
            <label>
              {t('experienceOptional')}
              <input
                type="number"
                min={0}
                max={50}
                value={manageExperience}
                onChange={(e) => setManageExperience(e.target.value)}
                placeholder="e.g. 4"
              />
            </label>
            <label>
              {t('serviceInformation')}
              <textarea
                rows={3}
                value={manageNotes}
                onChange={(e) => setManageNotes(e.target.value)}
                placeholder={t('serviceInformationPlaceholder')}
              />
            </label>
          </div>
          <div className="modal-section">
            <h4>{t('serviceDocuments')}</h4>
            {manageRequiredDocs.length ? (
              <ul className="doc-list interactive-list">
                {manageRequiredDocs.map((doc) => {
                  const existing = manageQual?.documents?.find(
                    (item) => String(item.key || '') === doc.key,
                  );
                  const url = resolveUploadUrl(existing?.url);
                  const inputKey = `service:${manageService}:${doc.key}`;
                  return (
                    <li key={doc.key}>
                      <div className="doc-row">
                        <div>
                          <strong>{doc.label}</strong>
                          <p className="muted compact">
                            {url
                              ? existing?.fileName || t('serviceDocuments')
                              : t('notProvided')}
                          </p>
                        </div>
                        <div className="actions">
                          {url ? (
                            <a
                              className="hs-btn hs-btn--ghost hs-btn--md"
                              href={url}
                              target="_blank"
                              rel="noreferrer">
                              {t('open')}
                            </a>
                          ) : null}
                          <input
                            ref={(el) => {
                              fileInputRefs.current[inputKey] = el;
                            }}
                            type="file"
                            accept="image/*,application/pdf"
                            className="visually-hidden"
                            onChange={(e) =>
                              void onUploadServiceDoc(doc.key, e.target.files?.[0])
                            }
                          />
                          <Button
                            variant="ghost"
                            disabled={manageUploadBusyKey === doc.key}
                            onClick={() => fileInputRefs.current[inputKey]?.click()}>
                            <Icon name="upload" size={16} />
                            {manageUploadBusyKey === doc.key
                              ? t('uploading')
                              : url
                                ? t('uploadDocument')
                                : t('uploadDocument')}
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">{t('noServiceDocuments')}</p>
            )}
          </div>
          {manageError ? <p className="error-text">{manageError}</p> : null}
          <div className="modal-actions">
            <Button
              variant="primary"
              disabled={manageBusy}
              loading={manageBusy}
              onClick={() => void onSaveServiceProfile()}>
              {manageBusy ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={() => setManageService(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {docReject ? (
        <Dialog open
          title={`${t('reject')} ${docReject}`}
          onClose={() => setDocReject(null)}>
          <div className="modal-form">
            <label>
              {t('rejectionReason')}
              <textarea
                rows={3}
                value={docRejectReason}
                onChange={(e) => setDocRejectReason(e.target.value)}
                autoFocus
              />
            </label>
          </div>
          <div className="modal-actions">
            <Button variant="danger" disabled={saving} onClick={() => void rejectDoc()}>
              {t('reject')}
            </Button>
            <Button variant="ghost" onClick={() => setDocReject(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {addServiceOpen ? (
        <Dialog
          open
          title={t('addServiceToPartner', {name: name || provider._id})}
          onClose={() => setAddServiceOpen(false)}>
          <ul className="add-service-list">
            {serviceOptions.map((opt) => {
              const added = listedServices.some(
                (s) => s.toLowerCase() === opt.value.toLowerCase(),
              );
              return (
                <li key={opt.value} className="add-service-row">
                  <span>
                    <strong>{opt.label}</strong>
                    <span className="muted compact">
                      {added ? t('serviceAlreadyAdded') : t('serviceAvailable')}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant={added ? 'ghost' : 'secondary'}
                    disabled={added || serviceBusy}
                    onClick={() => void onAddPartnerService(opt.value)}>
                    {added ? t('serviceAlreadyAdded') : t('addPartnerService')}
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setAddServiceOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {pinOpen ? (
        <Dialog
          open
          title={t('resetPartnerPin')}
          onClose={() => setPinOpen(false)}>
          <p className="modal-lead">{t('resetPartnerPinLead')}</p>
          <div className="modal-form">
            <label>
              {t('partnerLoginPin')}
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
          </div>
          {pinMessage ? <p className="error-text">{pinMessage}</p> : null}
          <div className="modal-actions">
            <Button
              variant="primary"
              disabled={pinBusy}
              onClick={() => void onResetPartnerPin()}>
              {pinBusy ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={() => setPinOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {deactivateOpen ? (
        <Dialog
          open
          title={t('deactivatePartnerTitle')}
          onClose={() => setDeactivateOpen(false)}>
          <p className="modal-lead">
            {t('deactivatePartnerLead', {name: name || provider._id})}
          </p>
          <div className="modal-form">
            <label>
              {t('deactivationReason')}
              <textarea
                rows={3}
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                autoFocus
              />
            </label>
          </div>
          {deactivateError ? (
            <p className="error-text">{deactivateError}</p>
          ) : null}
          <div className="modal-actions">
            <Button
              variant="danger"
              disabled={deactivateBusy}
              onClick={() => void onDeactivatePartner()}>
              {deactivateBusy ? t('saving') : t('deactivatePartnerAccess')}
            </Button>
            <Button variant="ghost" onClick={() => setDeactivateOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
