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
  getPartnerVerificationSettings,
  updatePartnerVerificationSettings,
  type PartnerVerificationMode,
} from '../../services/api/partnerVerificationApi';

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

  const onSaveClick = () => {
    if (!canUpdate || mode === savedMode) return;
    setConfirmOpen(true);
  };

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
    <>
      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="partner-verification-success-banner"
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel contact-privacy-panel">
        <div className="contact-privacy-panel-head">
          <h2>{t('partnerVerificationPolicyLabel')}</h2>
          <p className="muted compact">
            {t('partnerVerificationCurrent', {
              mode: t(`partnerVerificationOption_${savedMode}`),
            })}
          </p>
        </div>

        {loading ? (
          <p className="muted compact contact-privacy-loading">
            {t('loading')}
          </p>
        ) : (
          <fieldset className="policy-radios" disabled={!canUpdate}>
            <legend className="sr-only">{t('partnerVerificationPolicyLabel')}</legend>
            {MODE_OPTIONS.map((value) => (
              <label key={value} className="policy-radio">
                <input
                  type="radio"
                  name="partnerVerificationMode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <span>
                  <strong>{t(`partnerVerificationOption_${value}`)}</strong>
                  <span className="muted compact">
                    {t(`partnerVerificationHelp_${value}`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="contact-privacy-actions">
          <Button
            variant="primary"
            disabled={!canUpdate || loading || saving || mode === savedMode}
            onClick={onSaveClick}>
            {saving ? t('saving') : t('save')}
          </Button>
          {!canUpdate ? (
            <p className="muted compact">{t('partnerVerificationNoPermission')}</p>
          ) : null}
        </div>
      </section>

      {confirmOpen ? (
        <Dialog
          open
          title={t('partnerVerificationConfirmTitle')}
          onClose={() => setConfirmOpen(false)}
          testId="partner-verification-confirm">
          <p>{t('partnerVerificationConfirmBody')}</p>
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
