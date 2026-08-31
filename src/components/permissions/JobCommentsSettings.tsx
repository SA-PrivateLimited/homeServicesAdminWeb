import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {type SuccessBannerContent} from '../SuccessBanner';
import {usePermissions} from '../../hooks/usePermissions';
import {PERMISSIONS} from '../../constants/permissions';
import {
  getJobCommentsSettings,
  updateJobCommentsSettings,
} from '../../services/api/jobCommentsApi';
import {PolicySettingsCard} from './PolicySettingsCard';

type JobChatMode = 'ON' | 'OFF';

export function JobCommentsSettings() {
  const {t} = useTranslation();
  const {canAccess} = usePermissions();
  const canUpdate = canAccess(PERMISSIONS.JOBS_UPDATE);

  const [enabled, setEnabled] = useState(true);
  const [savedEnabled, setSavedEnabled] = useState(true);
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
      const data = await getJobCommentsSettings();
      const next = Boolean(data.allowJobCardComments);
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

  const mode: JobChatMode = enabled ? 'ON' : 'OFF';
  const savedMode: JobChatMode = savedEnabled ? 'ON' : 'OFF';

  const onConfirmSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateJobCommentsSettings(enabled);
      const next = Boolean(data.allowJobCardComments);
      setEnabled(next);
      setSavedEnabled(next);
      setConfirmOpen(false);
      setSuccessBanner({
        title: t('jobCommentsSavedTitle'),
        detail: t(
          next ? 'jobCommentsSavedDetailOn' : 'jobCommentsSavedDetailOff',
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
      title={t('jobCommentsPolicyLabel')}
      currentLabel={t(`jobCommentsOption_${savedMode}`)}
      legend={t('jobCommentsPolicyLabel')}
      name="allowJobCardComments"
      options={(['ON', 'OFF'] as const).map((value) => ({
        value,
        title: t(`jobCommentsOption_${value}`),
        help: t(`jobCommentsHelp_${value}`),
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
      noPermissionText={t('jobCommentsNoPermission')}
      confirmOpen={confirmOpen}
      confirmTitle={t('jobCommentsConfirmTitle')}
      confirmBody={t(
        enabled ? 'jobCommentsConfirmBodyOn' : 'jobCommentsConfirmBodyOff',
      )}
      onConfirm={() => void onConfirmSave()}
      onCancelConfirm={() => setConfirmOpen(false)}
      continueLabel={t('continue')}
      cancelLabel={t('cancel')}
      successBanner={successBanner}
      onDismissBanner={() => setSuccessBanner(null)}
      bannerTestId="job-comments-success-banner"
      confirmTestId="job-comments-confirm"
    />
  );
}
