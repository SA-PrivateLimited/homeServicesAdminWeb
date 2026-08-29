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
  getContactPrivacySettings,
  updateContactPrivacySettings,
  type ProviderContactPolicy,
} from '../../services/api/contactPrivacyApi';

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

  const onSaveClick = () => {
    if (!canUpdate || policy === savedPolicy) return;
    setConfirmOpen(true);
  };

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
    <>
      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="contact-privacy-success-banner"
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel contact-privacy-panel">
        <div className="contact-privacy-panel-head">
          <h2>{t('contactPrivacyPolicyLabel')}</h2>
          <p className="muted compact">
            {t('contactPrivacyCurrent', {
              policy: t(`contactPrivacyOption_${savedPolicy}`),
            })}
          </p>
        </div>

        {loading ? (
          <p className="muted compact contact-privacy-loading">
            {t('loading')}
          </p>
        ) : (
          <fieldset className="policy-radios" disabled={!canUpdate}>
            <legend className="sr-only">{t('contactPrivacyPolicyLabel')}</legend>
            {POLICY_OPTIONS.map((value) => (
              <label key={value} className="policy-radio">
                <input
                  type="radio"
                  name="providerContactPolicy"
                  value={value}
                  checked={policy === value}
                  onChange={() => setPolicy(value)}
                />
                <span>
                  <strong>{t(`contactPrivacyOption_${value}`)}</strong>
                  <span className="muted compact">
                    {t(`contactPrivacyHelp_${value}`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="contact-privacy-actions">
          <Button
            variant="primary"
            disabled={
              !canUpdate || loading || saving || policy === savedPolicy
            }
            onClick={onSaveClick}>
            {saving ? t('saving') : t('save')}
          </Button>
          {!canUpdate ? (
            <p className="muted compact">{t('contactPrivacyNoPermission')}</p>
          ) : null}
        </div>
      </section>

      {confirmOpen ? (
        <Dialog
          open
          title={t('contactPrivacyConfirmTitle')}
          onClose={() => setConfirmOpen(false)}
          testId="contact-privacy-confirm">
          <p>{t('contactPrivacyConfirmBody')}</p>
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
