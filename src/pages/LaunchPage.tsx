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
  LAUNCH_WISH_ICONS,
  LAUNCH_GREETING_PRESETS,
  LAUNCH_COUNTDOWN_PRESETS,
  LAUNCH_ANIMATION_MODES,
  type LaunchState,
  type LaunchWishIcon,
  type LaunchCloseMode,
  type LaunchAnimationMode,
} from '../services/api/launchApi';
import '../styles/pages.css';
import './LaunchPage.css';

export function LaunchPage() {
  const {t} = useTranslation();
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);

  const [state, setState] = useState<LaunchState>('NORMAL');
  const [closeMode, setCloseMode] = useState<LaunchCloseMode>('GLOBAL');
  const [eventName, setEventName] = useState('Akanso');
  const [greeting, setGreeting] = useState('Happy Holi');
  const [cta, setCta] = useState('Happy Holi');
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [animationMode, setAnimationMode] =
    useState<LaunchAnimationMode>('AUTO');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [icon, setIcon] = useState<LaunchWishIcon>('celebration');
  const [savedState, setSavedState] = useState<LaunchState>('NORMAL');
  const [savedCloseMode, setSavedCloseMode] = useState<LaunchCloseMode>('GLOBAL');
  const [savedEventName, setSavedEventName] = useState('Akanso');
  const [savedGreeting, setSavedGreeting] = useState('Happy Holi');
  const [savedCta, setSavedCta] = useState('Happy Holi');
  const [savedCountdownSeconds, setSavedCountdownSeconds] = useState(10);
  const [savedAnimationMode, setSavedAnimationMode] =
    useState<LaunchAnimationMode>('AUTO');
  const [savedName, setSavedName] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [savedIcon, setSavedIcon] = useState<LaunchWishIcon>('celebration');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);

  const dirty =
    state !== savedState ||
    closeMode !== savedCloseMode ||
    eventName.trim() !== savedEventName ||
    greeting.trim() !== savedGreeting ||
    cta.trim() !== savedCta ||
    countdownSeconds !== savedCountdownSeconds ||
    animationMode !== savedAnimationMode ||
    name.trim() !== savedName ||
    message.trim() !== savedMessage ||
    icon !== savedIcon;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLaunchConfig();
      setState(data.state);
      setCloseMode(data.closeMode);
      setEventName(data.eventName);
      setGreeting(data.greeting);
      setCta(data.cta);
      setCountdownSeconds(data.countdownSeconds);
      setAnimationMode(data.animationMode);
      setName(data.name);
      setMessage(data.message);
      setIcon(data.icon);
      setSavedState(data.state);
      setSavedCloseMode(data.closeMode);
      setSavedEventName(data.eventName);
      setSavedGreeting(data.greeting);
      setSavedCta(data.cta);
      setSavedCountdownSeconds(data.countdownSeconds);
      setSavedAnimationMode(data.animationMode);
      setSavedName(data.name);
      setSavedMessage(data.message);
      setSavedIcon(data.icon);
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
    setConfirmOpen(true);
  };

  const onConfirmSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateLaunchConfig({
        state,
        closeMode,
        eventName: eventName.trim() || 'Akanso',
        greeting: greeting.trim() || 'Happy Holi',
        cta: cta.trim() || greeting.trim() || 'Happy Holi',
        countdownSeconds,
        animationMode,
        name: name.trim(),
        message: message.trim(),
        icon,
      });
      setState(data.state);
      setCloseMode(data.closeMode);
      setEventName(data.eventName);
      setGreeting(data.greeting);
      setCta(data.cta);
      setCountdownSeconds(data.countdownSeconds);
      setAnimationMode(data.animationMode);
      setName(data.name);
      setMessage(data.message);
      setIcon(data.icon);
      setSavedState(data.state);
      setSavedCloseMode(data.closeMode);
      setSavedEventName(data.eventName);
      setSavedGreeting(data.greeting);
      setSavedCta(data.cta);
      setSavedCountdownSeconds(data.countdownSeconds);
      setSavedAnimationMode(data.animationMode);
      setSavedName(data.name);
      setSavedMessage(data.message);
      setSavedIcon(data.icon);
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
    <div className="admin-page scale-baseline-80 launch-admin-page" data-testid="launch-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('launchTitle')}</h1>
          <p>{t('launchLead')}</p>
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
          testId="launch-success-banner"
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel launch-admin-panel">
        <div className="launch-admin-panel-head">
          <h2>{t('launchStateLabel')}</h2>
          <p className="muted compact">
            {t('launchCurrent', {
              state: t(`launchState_${savedState}`),
            })}
          </p>
        </div>

        {loading ? (
          <p className="muted compact launch-admin-loading">{t('loading')}</p>
        ) : (
          <div className="launch-admin-grid">
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

            <fieldset className="policy-radios">
              <legend>{t('launchCloseModeLabel')}</legend>
              <p className="muted compact">{t('launchCloseModeHelp')}</p>
              {(['PER_PERSON', 'GLOBAL'] as LaunchCloseMode[]).map((value) => (
                <label key={value} className="policy-radio">
                  <input
                    type="radio"
                    name="websiteLaunchCloseMode"
                    value={value}
                    checked={closeMode === value}
                    onChange={() => setCloseMode(value)}
                  />
                  <span>
                    <strong>{t(`launchCloseMode_${value}`)}</strong>
                    <span className="muted compact">
                      {t(`launchCloseModeHelp_${value}`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="form-row">
              <legend>{t('launchCountdownLabel')}</legend>
              <p className="muted compact">{t('launchCountdownHelp')}</p>
              <div className="launch-greeting-grid" role="radiogroup">
                {LAUNCH_COUNTDOWN_PRESETS.map((value) => (
                  <label
                    key={value}
                    className={`launch-icon-option${
                      countdownSeconds === value ? ' is-selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="websiteLaunchCountdown"
                      value={value}
                      checked={countdownSeconds === value}
                      onChange={() => setCountdownSeconds(value)}
                    />
                    <span>{t('launchCountdownSeconds', {count: value})}</span>
                  </label>
                ))}
              </div>
              <label htmlFor="launch-countdown-custom">
                {t('launchCountdownCustom')}
              </label>
              <input
                id="launch-countdown-custom"
                type="number"
                min={0}
                max={30}
                step={1}
                value={countdownSeconds}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(next)) {
                    setCountdownSeconds(10);
                    return;
                  }
                  setCountdownSeconds(Math.min(30, Math.max(0, next)));
                }}
              />
            </fieldset>

            <fieldset className="form-row launch-admin-span">
              <legend>{t('launchAnimationLabel')}</legend>
              <p className="muted compact">{t('launchAnimationHelp')}</p>
              <div className="launch-greeting-grid" role="radiogroup">
                {LAUNCH_ANIMATION_MODES.map((value) => (
                  <label
                    key={value}
                    className={`launch-icon-option${
                      animationMode === value ? ' is-selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="websiteLaunchAnimation"
                      value={value}
                      checked={animationMode === value}
                      onChange={() => setAnimationMode(value)}
                    />
                    <span>{t(`launchAnimation_${value}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="form-row">
              <label htmlFor="launch-event-name">{t('launchEventNameLabel')}</label>
              <input
                id="launch-event-name"
                type="text"
                value={eventName}
                maxLength={80}
                placeholder={t('launchEventNamePlaceholder')}
                onChange={(e) => setEventName(e.target.value)}
                autoComplete="off"
              />
              <p className="muted compact">{t('launchEventNameHelp')}</p>
            </div>

            <fieldset className="form-row launch-admin-span">
              <legend>{t('launchGreetingLabel')}</legend>
              <p className="muted compact">{t('launchGreetingHelp')}</p>
              <div className="launch-greeting-grid" role="radiogroup">
                {LAUNCH_GREETING_PRESETS.map((value) => (
                  <label
                    key={value}
                    className={`launch-icon-option${
                      greeting === value ? ' is-selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="websiteLaunchGreeting"
                      value={value}
                      checked={greeting === value}
                      onChange={() => {
                        setCta((prev) =>
                          prev.trim() === greeting.trim() ? value : prev,
                        );
                        setGreeting(value);
                      }}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
              <label htmlFor="launch-greeting-custom">
                {t('launchGreetingCustom')}
              </label>
              <input
                id="launch-greeting-custom"
                type="text"
                value={greeting}
                maxLength={80}
                placeholder={t('launchGreetingPlaceholder')}
                onChange={(e) => {
                  const next = e.target.value;
                  setCta((prev) =>
                    prev.trim() === greeting.trim() ? next : prev,
                  );
                  setGreeting(next);
                }}
                autoComplete="off"
              />
            </fieldset>

            <div className="form-row">
              <label htmlFor="launch-cta">{t('launchCtaLabel')}</label>
              <input
                id="launch-cta"
                type="text"
                value={cta}
                maxLength={80}
                placeholder={greeting.trim() || t('launchGreetingPlaceholder')}
                onChange={(e) => setCta(e.target.value)}
                autoComplete="off"
              />
              <p className="muted compact">{t('launchCtaHelp')}</p>
            </div>

            <fieldset className="form-row">
              <legend>{t('launchIconLabel')}</legend>
              <p className="muted compact">{t('launchIconHelp')}</p>
              <div className="launch-icon-grid" role="radiogroup">
                {LAUNCH_WISH_ICONS.map((value) => (
                  <label
                    key={value}
                    className={`launch-icon-option${
                      icon === value ? ' is-selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="websiteLaunchIcon"
                      value={value}
                      checked={icon === value}
                      onChange={() => setIcon(value)}
                    />
                    <span className="material-symbols-outlined" aria-hidden>
                      {value}
                    </span>
                    <span className="muted compact">
                      {t(`launchIcon_${value}`)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="muted compact launch-admin-span">{t('launchVisitorHelp')}</p>

            <div className="form-row">
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
          </div>
        )}

        <div className="launch-admin-actions">
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
