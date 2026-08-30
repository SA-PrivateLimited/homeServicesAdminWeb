import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Dialog} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  type SuccessBannerContent,
} from '../SuccessBanner';
import {usePermissions} from '../../hooks/usePermissions';
import {PERMISSIONS} from '../../constants/permissions';
import {
  getJobCommentsSettings,
  updateJobCommentsSettings,
} from '../../services/api/jobCommentsApi';

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

  const onSaveClick = () => {
    if (!canUpdate || enabled === savedEnabled) return;
    setConfirmOpen(true);
  };

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
    <>
      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="job-comments-success-banner"
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel contact-privacy-panel">
        <div className="contact-privacy-panel-head">
          <h2>{t('jobCommentsPolicyLabel')}</h2>
          <p className="muted compact">
            {t('jobCommentsCurrent', {
              mode: t(
                savedEnabled
                  ? 'jobCommentsOption_ON'
                  : 'jobCommentsOption_OFF',
              ),
            })}
          </p>
        </div>

        {loading ? (
          <p className="muted compact contact-privacy-loading">
            {t('loading')}
          </p>
        ) : (
          <fieldset className="policy-radios" disabled={!canUpdate}>
            <legend className="sr-only">{t('jobCommentsPolicyLabel')}</legend>
            <label className="policy-radio">
              <input
                type="radio"
                name="allowJobCardComments"
                checked={enabled}
                onChange={() => setEnabled(true)}
              />
              <span>
                <strong>{t('jobCommentsOption_ON')}</strong>
                <span className="muted compact">
                  {t('jobCommentsHelp_ON')}
                </span>
              </span>
            </label>
            <label className="policy-radio">
              <input
                type="radio"
                name="allowJobCardComments"
                checked={!enabled}
                onChange={() => setEnabled(false)}
              />
              <span>
                <strong>{t('jobCommentsOption_OFF')}</strong>
                <span className="muted compact">
                  {t('jobCommentsHelp_OFF')}
                </span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="contact-privacy-actions">
          <Button
            variant="primary"
            disabled={
              !canUpdate || loading || saving || enabled === savedEnabled
            }
            onClick={onSaveClick}>
            {saving ? t('saving') : t('save')}
          </Button>
          {!canUpdate ? (
            <p className="muted compact">{t('jobCommentsNoPermission')}</p>
          ) : null}
        </div>
      </section>

      {confirmOpen ? (
        <Dialog
          open
          title={t('jobCommentsConfirmTitle')}
          onClose={() => setConfirmOpen(false)}
          testId="job-comments-confirm">
          <p>
            {t(
              enabled
                ? 'jobCommentsConfirmBodyOn'
                : 'jobCommentsConfirmBodyOff',
            )}
          </p>
          <div className="actions">
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void onConfirmSave()}>
              {saving ? t('saving') : t('continue')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
