import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Dialog} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {usePermissions} from '../hooks/usePermissions';
import {PERMISSIONS} from '../constants/permissions';
import {
  getProviderOpenRequestSettings,
  updateProviderOpenRequestSettings,
} from '../services/api/providerOpenRequestsApi';
import '../styles/pages.css';

export function ProviderOpenRequestsPage() {
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

  const onSaveClick = () => {
    if (!canUpdate || enabled === savedEnabled) return;
    setConfirmOpen(true);
  };

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
    <div
      className="admin-page scale-baseline-80"
      data-testid="provider-open-requests-root">
      <header className="page-header">
        <h1>{t('providerOpenRequestsTitle')}</h1>
        <p>{t('providerOpenRequestsLead')}</p>
      </header>

      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="provider-open-requests-success-banner"
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel contact-privacy-panel">
        <div className="contact-privacy-panel-head">
          <h2>{t('providerOpenRequestsPolicyLabel')}</h2>
          <p className="muted compact">
            {t('providerOpenRequestsCurrent', {
              mode: t(
                savedEnabled
                  ? 'providerOpenRequestsOption_ON'
                  : 'providerOpenRequestsOption_OFF',
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
            <legend className="sr-only">
              {t('providerOpenRequestsPolicyLabel')}
            </legend>
            <label className="policy-radio">
              <input
                type="radio"
                name="allowOfflineProviderOpenRequests"
                checked={!enabled}
                onChange={() => setEnabled(false)}
              />
              <span>
                <strong>{t('providerOpenRequestsOption_OFF')}</strong>
                <span className="muted compact">
                  {t('providerOpenRequestsHelp_OFF')}
                </span>
              </span>
            </label>
            <label className="policy-radio">
              <input
                type="radio"
                name="allowOfflineProviderOpenRequests"
                checked={enabled}
                onChange={() => setEnabled(true)}
              />
              <span>
                <strong>{t('providerOpenRequestsOption_ON')}</strong>
                <span className="muted compact">
                  {t('providerOpenRequestsHelp_ON')}
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
            <p className="muted compact">
              {t('providerOpenRequestsNoPermission')}
            </p>
          ) : null}
        </div>
      </section>

      {confirmOpen ? (
        <Dialog
          open
          title={t('providerOpenRequestsConfirmTitle')}
          onClose={() => setConfirmOpen(false)}
          testId="provider-open-requests-confirm">
          <p>
            {t(
              enabled
                ? 'providerOpenRequestsConfirmBodyOn'
                : 'providerOpenRequestsConfirmBodyOff',
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
    </div>
  );
}
