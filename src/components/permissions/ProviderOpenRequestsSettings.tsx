import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {type SuccessBannerContent} from '../SuccessBanner';
import {usePermissions} from '../../hooks/usePermissions';
import {PERMISSIONS} from '../../constants/permissions';
import {
  getProviderOpenRequestSettings,
  updateProviderOpenRequestSettings,
} from '../../services/api/providerOpenRequestsApi';
import {PolicySettingsCard} from './PolicySettingsCard';

type OpenRequestMode = 'OFF' | 'ON';

export function ProviderOpenRequestsSettings() {
  const {t} = useTranslation();
  const {canAccess} = usePermissions();
  const canUpdate = canAccess(PERMISSIONS.PROVIDERS_UPDATE);

  const [enabled, setEnabled] = useState(false);
  const [savedEnabled, setSavedEnabled] = useState(false);
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
      const data = await getProviderOpenRequestSettings();
      const next = Boolean(data.allowOfflineProviderOpenRequests);
      setEnabled(next);
      setSavedEnabled(next);
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

  const mode: OpenRequestMode = enabled ? 'ON' : 'OFF';
  const savedMode: OpenRequestMode = savedEnabled ? 'ON' : 'OFF';

  const onConfirmSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateProviderOpenRequestSettings(enabled);
      const next = Boolean(data.allowOfflineProviderOpenRequests);
      setEnabled(next);
      setSavedEnabled(next);
      setConfirmOpen(false);
      setSuccessBanner({
        title: t('providerOpenRequestsSavedTitle'),
        detail: t(
          next
            ? 'providerOpenRequestsSavedDetailOn'
            : 'providerOpenRequestsSavedDetailOff',
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PolicySettingsCard
      title={t('providerOpenRequestsPolicyLabel')}
      currentLabel={t(`providerOpenRequestsOption_${savedMode}`)}
      legend={t('providerOpenRequestsPolicyLabel')}
      name="allowOfflineProviderOpenRequests"
      options={(['OFF', 'ON'] as const).map((value) => ({
        value,
        title: t(`providerOpenRequestsOption_${value}`),
        help: t(`providerOpenRequestsHelp_${value}`),
      }))}
      value={mode}
      onChange={(next) => setEnabled(next === 'ON')}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      retryLabel={t('retry')}
      canUpdate={canUpdate}
      dirty={enabled !== savedEnabled}
      saving={saving}
      onSave={() => {
        if (!canUpdate || enabled === savedEnabled) return;
        setConfirmOpen(true);
      }}
      saveLabel={t('save')}
      savingLabel={t('saving')}
      noPermissionText={t('providerOpenRequestsNoPermission')}
      confirmOpen={confirmOpen}
      confirmTitle={t('providerOpenRequestsConfirmTitle')}
      confirmBody={t(
        enabled
          ? 'providerOpenRequestsConfirmBodyOn'
          : 'providerOpenRequestsConfirmBodyOff',
      )}
      onConfirm={() => void onConfirmSave()}
      onCancelConfirm={() => setConfirmOpen(false)}
      continueLabel={t('continue')}
      cancelLabel={t('cancel')}
      successBanner={successBanner}
      onDismissBanner={() => setSuccessBanner(null)}
      bannerTestId="provider-open-requests-success-banner"
      confirmTestId="provider-open-requests-confirm"
    />
  );
}
