import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {type SuccessBannerContent} from '../SuccessBanner';
import {usePermissions} from '../../hooks/usePermissions';
import {PERMISSIONS} from '../../constants/permissions';
import {
  getContactPrivacySettings,
  updateContactPrivacySettings,
  type ProviderContactPolicy,
} from '../../services/api/contactPrivacyApi';
import {PolicySettingsCard} from './PolicySettingsCard';

const POLICY_OPTIONS: ProviderContactPolicy[] = [
  'DIRECT',
  'MASKED',
  'ACCEPTED_ONLY',
  'ACTIVE_REQUEST_ONLY',
];

export function ContactPrivacySettings() {
  const {t} = useTranslation();
  const {canAccess} = usePermissions();
  const canUpdate = canAccess(PERMISSIONS.CONTACTS_UPDATE);

  const [policy, setPolicy] = useState<ProviderContactPolicy>('DIRECT');
  const [savedPolicy, setSavedPolicy] = useState<ProviderContactPolicy>('DIRECT');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContactPrivacySettings();
      const next = data.providerContactPolicy || 'DIRECT';
      setPolicy(next);
      setSavedPolicy(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!successBanner) return;
    const timer = window.setTimeout(() => setSuccessBanner(null), 8000);
    return () => window.clearTimeout(timer);
  }, [successBanner]);

  const onConfirmSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateContactPrivacySettings(policy);
      const next = data.providerContactPolicy || policy;
      setPolicy(next);
      setSavedPolicy(next);
      setConfirmOpen(false);
      setSuccessBanner({
        title: t('contactPrivacySavedTitle'),
        detail: t('contactPrivacySavedDetail'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PolicySettingsCard
      title={t('contactPrivacyPolicyLabel')}
      currentLabel={t(`contactPrivacyOption_${savedPolicy}`)}
      legend={t('contactPrivacyPolicyLabel')}
      name="providerContactPolicy"
      options={POLICY_OPTIONS.map((value) => ({
        value,
        title: t(`contactPrivacyOption_${value}`),
        help: t(`contactPrivacyHelp_${value}`),
      }))}
      value={policy}
      onChange={setPolicy}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      retryLabel={t('retry')}
      canUpdate={canUpdate}
      dirty={policy !== savedPolicy}
      saving={saving}
      onSave={() => {
        if (!canUpdate || policy === savedPolicy) return;
        setConfirmOpen(true);
      }}
      saveLabel={t('save')}
      savingLabel={t('saving')}
      noPermissionText={t('contactPrivacyNoPermission')}
      confirmOpen={confirmOpen}
      confirmTitle={t('contactPrivacyConfirmTitle')}
      confirmBody={t('contactPrivacyConfirmBody')}
      onConfirm={() => void onConfirmSave()}
      onCancelConfirm={() => setConfirmOpen(false)}
      continueLabel={t('continue')}
      cancelLabel={t('cancel')}
      successBanner={successBanner}
      onDismissBanner={() => setSuccessBanner(null)}
      bannerTestId="contact-privacy-success-banner"
      confirmTestId="contact-privacy-confirm"
    />
  );
}
