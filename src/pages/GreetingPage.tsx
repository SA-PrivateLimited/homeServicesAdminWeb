import {useCallback, useEffect, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Button, Dialog, Icon} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {useAuthStore} from '../store/authStore';
import {
  getGreetingConfig,
  updateGreetingConfig,
  updateDoodleConfig,
  GREETING_PRESETS,
  GREETING_ANIMATION_MODES,
  GREETING_WISH_ICONS,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  endOfTodayDatetimeLocal,
  type GreetingConfig,
  type DoodleConfig,
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
  const [icon, setIcon] = useState('celebration');
  const [savedState, setSavedState] = useState<GreetingState>('NORMAL');
  const [savedCloseMode, setSavedCloseMode] =
    useState<GreetingCloseMode>('PER_PERSON');
  const [savedGreeting, setSavedGreeting] = useState('Happy Holi');
  const [savedTimerLocal, setSavedTimerLocal] = useState('');
  const [savedAnimationMode, setSavedAnimationMode] =
    useState<GreetingAnimationMode>('AUTO');
  const [savedMessage, setSavedMessage] = useState('');
  const [savedIcon, setSavedIcon] = useState('celebration');
  const [logoAccentUrl, setLogoAccentUrl] = useState('');
  const [savedLogoAccentUrl, setSavedLogoAccentUrl] = useState('');
  const [doodleEnabled, setDoodleEnabled] = useState(false);
  const [savedDoodleEnabled, setSavedDoodleEnabled] = useState(false);
  const [doodleTimerLocal, setDoodleTimerLocal] = useState('');
  const [savedDoodleTimerLocal, setSavedDoodleTimerLocal] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);
  const [tab, setTab] = useState<'page' | 'doodle'>('page');

  const pageDirty =
    state !== savedState ||
    closeMode !== savedCloseMode ||
    greeting.trim() !== savedGreeting ||
    timerLocal !== savedTimerLocal ||
    animationMode !== savedAnimationMode ||
    message.trim() !== savedMessage;
  const doodleDirty =
    icon.trim() !== savedIcon ||
    logoAccentUrl.trim() !== savedLogoAccentUrl ||
    doodleEnabled !== savedDoodleEnabled ||
    doodleTimerLocal !== savedDoodleTimerLocal;
  const dirty = tab === 'page' ? pageDirty : doodleDirty;

  const applyConfig = useCallback((data: GreetingConfig) => {
    const nextTimer = timerLocalFromConfig(data);
    setState(data.state);
    setCloseMode(data.closeMode);
    setGreeting(data.greeting);
    setTimerLocal(nextTimer);
    setAnimationMode(data.animationMode);
    setMessage(data.message);
    setIcon(data.icon || 'celebration');
    setLogoAccentUrl(data.logoAccentUrl);
    setDoodleEnabled(data.doodleEnabled);
    const nextDoodleTimer =
      toDatetimeLocalValue(data.doodleEndsAt) ||
      (data.doodleEnabled ? endOfTodayDatetimeLocal() : '');
    setDoodleTimerLocal(nextDoodleTimer);
    setSavedState(data.state);
    setSavedCloseMode(data.closeMode);
    setSavedGreeting(data.greeting);
    setSavedTimerLocal(nextTimer);
    setSavedAnimationMode(data.animationMode);
    setSavedMessage(data.message);
    setSavedIcon(data.icon || 'celebration');
    setSavedLogoAccentUrl(data.logoAccentUrl);
    setSavedDoodleEnabled(data.doodleEnabled);
    setSavedDoodleTimerLocal(nextDoodleTimer);
  }, []);

  const applyDoodle = useCallback((data: DoodleConfig) => {
    setIcon(data.icon || 'celebration');
    setLogoAccentUrl(data.logoAccentUrl);
    setDoodleEnabled(data.doodleEnabled);
    const nextDoodleTimer =
      toDatetimeLocalValue(data.doodleEndsAt) ||
      (data.doodleEnabled ? endOfTodayDatetimeLocal() : '');
    setDoodleTimerLocal(nextDoodleTimer);
    setSavedIcon(data.icon || 'celebration');
    setSavedLogoAccentUrl(data.logoAccentUrl);
    setSavedDoodleEnabled(data.doodleEnabled);
    setSavedDoodleTimerLocal(nextDoodleTimer);
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
    if (tab === 'page' && state === 'LAUNCH' && !fromDatetimeLocalValue(timerLocal)) {
      setError(t('greetingTimerRequired'));
      return;
    }
    if (
      tab === 'doodle' &&
      doodleEnabled &&
      !fromDatetimeLocalValue(doodleTimerLocal)
    ) {
      setError(t('greetingDoodleTimerRequired'));
      return;
    }
    setConfirmOpen(true);
  };

  const onConfirmSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (tab === 'page') {
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
        });
        applyConfig(data);
        setSuccessBanner({
          title: t('greetingSavedTitle'),
          detail:
            data.state === 'LAUNCH'
              ? t('greetingSavedDetailLaunch')
              : t('greetingSavedDetailNormal'),
        });
      } else {
        const data = await updateDoodleConfig({
          icon: icon.trim() || 'celebration',
          logoAccentUrl: logoAccentUrl.trim(),
          doodleEnabled,
          doodleEndsAt: fromDatetimeLocalValue(doodleTimerLocal),
        });
        applyDoodle(data);
        setSuccessBanner({
          title: t('greetingDoodleSavedTitle'),
          detail: data.doodleEnabled
            ? t('greetingDoodleSavedDetailOn')
            : t('greetingDoodleSavedDetailOff'),
        });
      }
      setConfirmOpen(false);
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
          <h1>{tab === 'page' ? t('greetingTitle') : t('greetingTabDoodle')}</h1>
          <p>{tab === 'page' ? t('greetingLead') : t('greetingDoodleLead')}</p>
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
        <div className="greeting-admin-tabs" role="tablist" aria-label={t('greetingTitle')}>
          <button
            type="button"
            role="tab"
            id="greeting-tab-page"
            aria-selected={tab === 'page'}
            aria-controls="greeting-panel-page"
            className={
              tab === 'page'
                ? 'greeting-admin-tab is-selected'
                : 'greeting-admin-tab'
            }
            onClick={() => setTab('page')}>
            {t('greetingTabPage')}
          </button>
          <button
            type="button"
            role="tab"
            id="greeting-tab-doodle"
            aria-selected={tab === 'doodle'}
            aria-controls="greeting-panel-doodle"
            className={
              tab === 'doodle'
                ? 'greeting-admin-tab is-selected'
                : 'greeting-admin-tab'
            }
            onClick={() => setTab('doodle')}>
            {t('greetingTabDoodle')}
          </button>
        </div>

        <div className="greeting-admin-panel-head">
          <h2>
            {tab === 'page' ? t('greetingStateLabel') : t('greetingTabDoodle')}
          </h2>
          <p className="muted compact">
            {tab === 'page'
              ? t('greetingCurrent', {
                  state: t(`greetingState_${savedState}`),
                })
              : t('greetingDoodleLead')}
          </p>
        </div>

        {loading ? (
          <p className="muted compact greeting-admin-loading">{t('loading')}</p>
        ) : tab === 'page' ? (
          <div
            id="greeting-panel-page"
            role="tabpanel"
            aria-labelledby="greeting-tab-page"
            className="greeting-admin-grid">
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
        ) : (
          <div
            id="greeting-panel-doodle"
            role="tabpanel"
            aria-labelledby="greeting-tab-doodle"
            className="greeting-admin-grid">
            <fieldset className="policy-radios greeting-admin-span">
              <legend>{t('greetingDoodleEnabledLabel')}</legend>
              <p className="muted compact">{t('greetingDoodleEnabledHelp')}</p>
              {([true, false] as const).map((value) => (
                <label key={String(value)} className="policy-radio">
                  <input
                    type="radio"
                    name="websiteLaunchDoodleEnabled"
                    checked={doodleEnabled === value}
                    onChange={() => {
                      setDoodleEnabled(value);
                      if (value && !doodleTimerLocal) {
                        setDoodleTimerLocal(endOfTodayDatetimeLocal());
                      }
                    }}
                  />
                  <span>
                    <strong>
                      {t(
                        value
                          ? 'greetingDoodleEnabled_on'
                          : 'greetingDoodleEnabled_off',
                      )}
                    </strong>
                    <span className="muted compact">
                      {t(
                        value
                          ? 'greetingDoodleEnabledHelp_on'
                          : 'greetingDoodleEnabledHelp_off',
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="form-row">
              <label htmlFor="greeting-doodle-timer">
                {t('greetingDoodleTimerLabel')}
              </label>
              <input
                id="greeting-doodle-timer"
                type="datetime-local"
                value={doodleTimerLocal}
                onChange={(e) => setDoodleTimerLocal(e.target.value)}
              />
              <p className="muted compact">{t('greetingDoodleTimerHelp')}</p>
            </div>

            <fieldset className="form-row greeting-admin-span">
              <legend>{t('greetingIconLabel')}</legend>
              <p className="muted compact">{t('greetingIconHelp')}</p>
              <div className="greeting-icon-grid" role="radiogroup">
                {GREETING_WISH_ICONS.map((value) => (
                  <label
                    key={value}
                    className={`greeting-icon-option${
                      icon === value ? ' is-selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="websiteLaunchIcon"
                      value={value}
                      checked={icon === value}
                      onChange={() => setIcon(value)}
                    />
                    <Icon name={value} size={22} filled />
                    <span>{value.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
              <label htmlFor="greeting-icon-custom">{t('greetingIconCustom')}</label>
              <input
                id="greeting-icon-custom"
                type="text"
                value={icon}
                maxLength={64}
                placeholder="celebration"
                onChange={(e) => setIcon(e.target.value.trim().toLowerCase())}
                autoComplete="off"
                spellCheck={false}
              />
            </fieldset>

            <div className="form-row greeting-admin-span">
              <label htmlFor="greeting-logo-accent">
                {t('greetingLogoAccentLabel')}
              </label>
              <p className="muted compact">{t('greetingLogoAccentHelp')}</p>
              <input
                id="greeting-logo-accent"
                type="url"
                value={logoAccentUrl}
                maxLength={500}
                placeholder="https://assets.akanso.in/..."
                onChange={(e) => setLogoAccentUrl(e.target.value)}
                autoComplete="off"
              />
              {logoAccentUrl.trim() ? (
                <img
                  className="greeting-admin-accent-preview"
                  src={logoAccentUrl.trim()}
                  alt=""
                  width={48}
                  height={48}
                />
              ) : null}
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
          title={
            tab === 'page'
              ? t('greetingConfirmTitle')
              : t('greetingDoodleConfirmTitle')
          }
          onClose={() => (!saving ? setConfirmOpen(false) : undefined)}
          testId="greeting-confirm">
          <p>
            {tab === 'page'
              ? t('greetingConfirmBody')
              : t('greetingDoodleConfirmBody')}
          </p>
          {tab === 'page' ? (
            state === 'LAUNCH' ? (
              <p className="muted compact">{t('greetingConfirmLaunchNote')}</p>
            ) : (
              <p className="muted compact">{t('greetingConfirmNormalNote')}</p>
            )
          ) : (
            <p className="muted compact">
              {doodleEnabled
                ? t('greetingDoodleConfirmOnNote')
                : t('greetingDoodleConfirmOffNote')}
            </p>
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
