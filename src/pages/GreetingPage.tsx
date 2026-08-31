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
  getGreetingConfig,
  updateGreetingConfig,
  GREETING_PRESETS,
  GREETING_ANIMATION_MODES,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  endOfTodayDatetimeLocal,
  type GreetingConfig,
  type GreetingState,
  type GreetingCloseMode,
  type GreetingAnimationMode,
} from '../services/api/greetingApi';
import '../styles/pages.css';
import './GreetingPage.css';

function timerLocalFromConfig(data: GreetingConfig): string {
  return (
    toDatetimeLocalValue(data.timerEndsAt) ||
    (data.state === 'LAUNCH' ? endOfTodayDatetimeLocal() : '')
  );
}

export function GreetingPage() {
  const {t} = useTranslation();
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);

  const [state, setState] = useState<GreetingState>('NORMAL');
  const [closeMode, setCloseMode] = useState<GreetingCloseMode>('PER_PERSON');
  const [greeting, setGreeting] = useState('Happy Holi');
  const [timerLocal, setTimerLocal] = useState('');
  const [animationMode, setAnimationMode] =
    useState<GreetingAnimationMode>('AUTO');
  const [message, setMessage] = useState('');
  const [savedState, setSavedState] = useState<GreetingState>('NORMAL');
  const [savedCloseMode, setSavedCloseMode] =
    useState<GreetingCloseMode>('PER_PERSON');
  const [savedGreeting, setSavedGreeting] = useState('Happy Holi');
  const [savedTimerLocal, setSavedTimerLocal] = useState('');
  const [savedAnimationMode, setSavedAnimationMode] =
    useState<GreetingAnimationMode>('AUTO');
  const [savedMessage, setSavedMessage] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);

  const dirty =
    state !== savedState ||
    closeMode !== savedCloseMode ||
    greeting.trim() !== savedGreeting ||
    timerLocal !== savedTimerLocal ||
    animationMode !== savedAnimationMode ||
    message.trim() !== savedMessage;

  const applyConfig = useCallback((data: GreetingConfig) => {
    const nextTimer = timerLocalFromConfig(data);
    setState(data.state);
    setCloseMode(data.closeMode);
    setGreeting(data.greeting);
    setTimerLocal(nextTimer);
    setAnimationMode(data.animationMode);
    setMessage(data.message);
    setSavedState(data.state);
    setSavedCloseMode(data.closeMode);
    setSavedGreeting(data.greeting);
    setSavedTimerLocal(nextTimer);
    setSavedAnimationMode(data.animationMode);
    setSavedMessage(data.message);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyConfig(await getGreetingConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [applyConfig, t]);

  useEffect(() => {
    if (!superAdminElevated) return;
    void load();
  }, [load, superAdminElevated]);

  useEffect(() => {
    if (!successBanner) return;
    const timer = window.setTimeout(() => setSuccessBanner(null), 8000);
    return () => window.clearTimeout(timer);
  }, [successBanner]);

  const onRefresh = useCallback(() => {
    if (loading || saving) return;
    setSuccessBanner(null);
    void load();
  }, [load, loading, saving]);

  if (!superAdminElevated) {
    return <Navigate to="/" replace />;
  }

  const onSaveClick = () => {
    if (!dirty || saving || loading) return;
    if (state === 'LAUNCH' && !fromDatetimeLocalValue(timerLocal)) {
      setError(t('greetingTimerRequired'));
      return;
    }
    setConfirmOpen(true);
  };

  const onConfirmSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateGreetingConfig({
        state,
        closeMode,
        eventName: 'Akanso',
        greeting: greeting.trim() || 'Happy Holi',
        cta: 'Continue',
        timerEndsAt: fromDatetimeLocalValue(timerLocal),
        animationMode,
        name: '',
        message: message.trim(),
        icon: 'celebration',
      });
      applyConfig(data);
      setConfirmOpen(false);
      setSuccessBanner({
        title: t('greetingSavedTitle'),
        detail:
          data.state === 'LAUNCH'
            ? t('greetingSavedDetailLaunch')
            : t('greetingSavedDetailNormal'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page scale-baseline-80 greeting-admin-page" data-testid="greeting-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('greetingTitle')}</h1>
          <p>{t('greetingLead')}</p>
        </div>
        <div className="row-header-actions">
          <Button
            variant="ghost"
            disabled={loading || saving}
            onClick={onRefresh}>
            {loading ? t('loading') : t('reload')}
          </Button>
        </div>
      </header>

      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="greeting-success-banner"
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel greeting-admin-panel">
        <div className="greeting-admin-panel-head">
          <h2>{t('greetingStateLabel')}</h2>
          <p className="muted compact">
            {t('greetingCurrent', {
              state: t(`greetingState_${savedState}`),
            })}
          </p>
        </div>

        {loading ? (
          <p className="muted compact greeting-admin-loading">{t('loading')}</p>
        ) : (
          <div className="greeting-admin-grid">
            <fieldset className="policy-radios">
              <legend className="sr-only">{t('greetingStateLabel')}</legend>
              {(['LAUNCH', 'NORMAL'] as GreetingState[]).map((value) => (
                <label key={value} className="policy-radio">
                  <input
                    type="radio"
                    name="websiteGreetingState"
                    value={value}
                    checked={state === value}
                    onChange={() => {
                      setState(value);
                      if (value === 'LAUNCH' && !timerLocal) {
                        setTimerLocal(endOfTodayDatetimeLocal());
                      }
                    }}
                  />
                  <span>
                    <strong>{t(`greetingState_${value}`)}</strong>
                    <span className="muted compact">
                      {t(`greetingStateHelp_${value}`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="form-row">
              <label htmlFor="greeting-timer">{t('greetingTimerLabel')}</label>
              <input
                id="greeting-timer"
                type="datetime-local"
                value={timerLocal}
                onChange={(e) => setTimerLocal(e.target.value)}
              />
              <p className="muted compact">{t('greetingTimerHelp')}</p>
            </div>

            <fieldset className="policy-radios">
              <legend>{t('greetingCloseModeLabel')}</legend>
              <p className="muted compact">{t('greetingCloseModeHelp')}</p>
              {(['PER_PERSON', 'GLOBAL'] as GreetingCloseMode[]).map((value) => (
                <label key={value} className="policy-radio">
                  <input
                    type="radio"
                    name="websiteGreetingCloseMode"
                    value={value}
                    checked={closeMode === value}
                    onChange={() => setCloseMode(value)}
                  />
                  <span>
                    <strong>{t(`greetingCloseMode_${value}`)}</strong>
                    <span className="muted compact">
                      {t(`greetingCloseModeHelp_${value}`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="form-row greeting-admin-span">
              <legend>{t('greetingAnimationLabel')}</legend>
              <p className="muted compact">{t('greetingAnimationHelp')}</p>
              <div className="greeting-chip-grid" role="radiogroup">
                {GREETING_ANIMATION_MODES.map((value) => (
                  <label
                    key={value}
                    className={`greeting-icon-option${
                      animationMode === value ? ' is-selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="websiteLaunchAnimation"
                      value={value}
                      checked={animationMode === value}
                      onChange={() => setAnimationMode(value)}
                    />
                    <span>{t(`greetingAnimation_${value}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="form-row greeting-admin-span">
              <legend>{t('greetingGreetingLabel')}</legend>
              <p className="muted compact">{t('greetingGreetingHelp')}</p>
              <div className="greeting-chip-grid" role="radiogroup">
                {GREETING_PRESETS.map((value) => (
                  <label
                    key={value}
                    className={`greeting-icon-option${
                      greeting === value ? ' is-selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="websiteLaunchGreeting"
                      value={value}
                      checked={greeting === value}
                      onChange={() => setGreeting(value)}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
              <label htmlFor="greeting-greeting-custom">
                {t('greetingGreetingCustom')}
              </label>
              <input
                id="greeting-greeting-custom"
                type="text"
                value={greeting}
                maxLength={80}
                placeholder={t('greetingGreetingPlaceholder')}
                onChange={(e) => setGreeting(e.target.value)}
                autoComplete="off"
              />
            </fieldset>

            <p className="muted compact greeting-admin-span">{t('greetingVisitorHelp')}</p>

            <div className="form-row">
              <label htmlFor="greeting-message">{t('greetingMessageLabel')}</label>
              <textarea
                id="greeting-message"
                value={message}
                maxLength={280}
                rows={3}
                placeholder={t('greetingMessagePlaceholder')}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="greeting-admin-actions">
          <Button
            variant="ghost"
            disabled={loading || saving}
            onClick={onRefresh}>
            {loading ? t('loading') : t('reload')}
          </Button>
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
          title={t('greetingConfirmTitle')}
          onClose={() => (!saving ? setConfirmOpen(false) : undefined)}
          testId="greeting-confirm">
          <p>{t('greetingConfirmBody')}</p>
          {state === 'LAUNCH' ? (
            <p className="muted compact">{t('greetingConfirmLaunchNote')}</p>
          ) : (
            <p className="muted compact">{t('greetingConfirmNormalNote')}</p>
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
