import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {type SuccessBannerContent} from '../SuccessBanner';
import {usePermissions} from '../../hooks/usePermissions';
import {PERMISSIONS} from '../../constants/permissions';
import {
  getPartnerVerificationSettings,
  updatePartnerVerificationSettings,
  type PartnerVerificationMode,
} from '../../services/api/partnerVerificationApi';
import {PolicySettingsCard} from './PolicySettingsCard';

const MODE_OPTIONS: PartnerVerificationMode[] = ['AUTO', 'ADMIN'];

export function PartnerVerificationSettings() {
  const {t} = useTranslation();
  const {canAccess} = usePermissions();
  const canUpdate = canAccess(PERMISSIONS.PROVIDERS_UPDATE);

  const [mode, setMode] = useState<PartnerVerificationMode>('AUTO');
  const [savedMode, setSavedMode] = useState<PartnerVerificationMode>('AUTO');
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
      const data = await getPartnerVerificationSettings();
      const next = data.partnerVerificationMode || 'AUTO';
      setMode(next);
      setSavedMode(next);
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
      const data = await updatePartnerVerificationSettings(mode);
      const next = data.partnerVerificationMode || mode;
      setMode(next);
      setSavedMode(next);
      setConfirmOpen(false);
      setSuccessBanner({
        title: t('partnerVerificationSavedTitle'),
        detail: t('partnerVerificationSavedDetail'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PolicySettingsCard
      title={t('partnerVerificationPolicyLabel')}
      currentLabel={t(`partnerVerificationOption_${savedMode}`)}
      legend={t('partnerVerificationPolicyLabel')}
      name="partnerVerificationMode"
      options={MODE_OPTIONS.map((value) => ({
        value,
        title: t(`partnerVerificationOption_${value}`),
        help: t(`partnerVerificationHelp_${value}`),
      }))}
      value={mode}
      onChange={setMode}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      retryLabel={t('retry')}
      canUpdate={canUpdate}
      dirty={mode !== savedMode}
      saving={saving}
      onSave={() => {
        if (!canUpdate || mode === savedMode) return;
        setConfirmOpen(true);
      }}
      saveLabel={t('save')}
      savingLabel={t('saving')}
      noPermissionText={t('partnerVerificationNoPermission')}
      confirmOpen={confirmOpen}
      confirmTitle={t('partnerVerificationConfirmTitle')}
      confirmBody={t('partnerVerificationConfirmBody')}
      onConfirm={() => void onConfirmSave()}
      onCancelConfirm={() => setConfirmOpen(false)}
      continueLabel={t('continue')}
      cancelLabel={t('cancel')}
      successBanner={successBanner}
      onDismissBanner={() => setSuccessBanner(null)}
      bannerTestId="partner-verification-success-banner"
      confirmTestId="partner-verification-confirm"
    />
  );
}
