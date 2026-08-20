import {useCallback, useEffect, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Button, Dialog} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {useAuthStore} from '../store/authStore';
import {
  getLaunchConfig,
  updateLaunchConfig,
  type LaunchState,
} from '../services/api/launchApi';
import '../styles/pages.css';

export function LaunchPage() {
  const {t} = useTranslation();
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);

  const [state, setState] = useState<LaunchState>('NORMAL');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [savedState, setSavedState] = useState<LaunchState>('NORMAL');
  const [savedName, setSavedName] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);

  const dirty =
    state !== savedState ||
    name.trim() !== savedName ||
    message.trim() !== savedMessage;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLaunchConfig();
      setState(data.state);
      setName(data.name);
      setMessage(data.message);
      setSavedState(data.state);
      setSavedName(data.name);
      setSavedMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!superAdminElevated) return;
    void load();
  }, [load, superAdminElevated]);

  useEffect(() => {
    if (!successBanner) return;
    const timer = window.setTimeout(() => setSuccessBanner(null), 8000);
    return () => window.clearTimeout(timer);
  }, [successBanner]);

  if (!superAdminElevated) {
    return <Navigate to="/" replace />;
  }

  const onSaveClick = () => {
    if (!dirty || saving || loading) return;
    setConfirmOpen(true);
  };

  const onConfirmSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateLaunchConfig({
        state,
        name: name.trim(),
        message: message.trim(),
      });
      setState(data.state);
      setName(data.name);
      setMessage(data.message);
      setSavedState(data.state);
      setSavedName(data.name);
      setSavedMessage(data.message);
      setConfirmOpen(false);
      setSuccessBanner({
        title: t('launchSavedTitle'),
        detail:
          data.state === 'LAUNCH'
            ? t('launchSavedDetailLaunch')
            : t('launchSavedDetailNormal'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page scale-baseline-80" data-testid="launch-root">
      <header className="page-header">
        <h1>{t('launchTitle')}</h1>
        <p>{t('launchLead')}</p>
      </header>

      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="launch-success-banner"
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel contact-privacy-panel">
        <div className="contact-privacy-panel-head">
          <h2>{t('launchStateLabel')}</h2>
          <p className="muted compact">
            {t('launchCurrent', {
              state: t(`launchState_${savedState}`),
            })}
          </p>
        </div>

        {loading ? (
          <p className="muted compact contact-privacy-loading">{t('loading')}</p>
        ) : (
          <>
            <fieldset className="policy-radios">
              <legend className="sr-only">{t('launchStateLabel')}</legend>
              {(['LAUNCH', 'NORMAL'] as LaunchState[]).map((value) => (
                <label key={value} className="policy-radio">
                  <input
                    type="radio"
                    name="websiteLaunchState"
                    value={value}
                    checked={state === value}
                    onChange={() => setState(value)}
                  />
                  <span>
                    <strong>{t(`launchState_${value}`)}</strong>
                    <span className="muted compact">
                      {t(`launchStateHelp_${value}`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="form-row" style={{marginTop: 20}}>
              <label htmlFor="launch-name">{t('launchNameLabel')}</label>
              <input
                id="launch-name"
                type="text"
                value={name}
                maxLength={200}
                placeholder={t('launchNamePlaceholder')}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="form-row">
              <label htmlFor="launch-message">{t('launchMessageLabel')}</label>
              <textarea
                id="launch-message"
                value={message}
                maxLength={2000}
                rows={5}
                placeholder={t('launchMessagePlaceholder')}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="contact-privacy-actions">
          <Button
            variant="primary"
            disabled={loading || saving || !dirty}
            onClick={onSaveClick}>
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </section>

      {confirmOpen ? (
        <Dialog
          open
          title={t('launchConfirmTitle')}
          onClose={() => (!saving ? setConfirmOpen(false) : undefined)}
          testId="launch-confirm">
          <p>{t('launchConfirmBody')}</p>
          {state === 'LAUNCH' ? (
            <p className="muted compact">{t('launchConfirmLaunchNote')}</p>
          ) : (
            <p className="muted compact">{t('launchConfirmNormalNote')}</p>
          )}
          <div className="actions">
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void onConfirmSave()}>
              {saving ? t('saving') : t('save')}
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
