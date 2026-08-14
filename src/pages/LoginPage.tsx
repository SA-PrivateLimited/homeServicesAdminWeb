import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {Navigate, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuthStore} from '../store/authStore';
import {getBrandLogoSrc, getRuntimeConfig} from '../config/runtime';
import './LoginPage.css';

type Step =
  | {name: 'credentials'}
  | {name: 'mfa'; mfaToken: string; email?: string}
  | {
      name: 'mfa_setup';
      mfaToken: string;
      email?: string;
      secret: string;
      qrCodeDataUrl: string;
    };

const SHOWCASE_SLIDES = [
  {
    src: '/login/login-electrician.jpg',
    title: 'Approve providers',
    caption: 'Review documents and activate trusted pros for your marketplace',
  },
  {
    src: '/login/login-plumber.jpg',
    title: 'Oversee jobs',
    caption: 'Monitor live service requests from booking to completion',
  },
  {
    src: '/login/login-carpenter.jpg',
    title: 'Manage coverage',
    caption: 'Geography, categories, and area demand in one operations hub',
  },
  {
    src: '/login/login-driver.jpg',
    title: 'Brand & clients',
    caption: 'White-label themes, product names, and client activation',
  },
] as const;

function LoginShowcase({
  brandName,
  logoSrc,
}: {
  brandName: string;
  logoSrc: string;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SHOWCASE_SLIDES.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <aside className="login-showcase" aria-hidden>
      <div className="login-showcase-brand">
        <img src={logoSrc} alt="" width={48} height={48} />
        <div>
          <strong>{brandName}</strong>
          <span>Operations & marketplace control</span>
        </div>
      </div>

      <div className="login-showcase-stage">
        {SHOWCASE_SLIDES.map((slide, i) => (
          <figure
            key={slide.src}
            className={`login-slide${i === active ? ' is-active' : ''}`}>
            <img src={slide.src} alt="" />
            <figcaption>
              <strong>{slide.title}</strong>
              <span>{slide.caption}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="login-showcase-dots">
        {SHOWCASE_SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            className={i === active ? 'is-active' : undefined}
            aria-label={slide.title}
            onClick={() => setActive(i)}
          />
        ))}
      </div>

      <p className="login-showcase-foot">
        Approve providers, track jobs, manage geography, and keep your
        marketplace running smoothly.
      </p>
    </aside>
  );
}

function LoginBrand({
  title,
  subtitle,
  logoSrc,
}: {
  title: string;
  subtitle: string;
  logoSrc: string;
}) {
  return (
    <div className="login-brand">
      <img
        className="login-brand-logo"
        src={logoSrc}
        alt=""
        width={64}
        height={64}
      />
      <h1>{title}</h1>
      <p className="sub">{subtitle}</p>
    </div>
  );
}

function LoginShell({
  children,
  testId,
  onSubmit,
  brandName,
  logoSrc,
}: {
  children: ReactNode;
  testId: string;
  onSubmit: (event: FormEvent) => void;
  brandName: string;
  logoSrc: string;
}) {
  return (
    <div className="login-layout">
      <LoginShowcase brandName={brandName} logoSrc={logoSrc} />
      <div className="login-form-pane">
        <form className="login-card" onSubmit={onSubmit} data-testid={testId}>
          {children}
        </form>
      </div>
    </div>
  );
}

export function LoginPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {user, beginLogin, completeMfaSetup, completeMfaVerify} =
    useAuthStore();
  const {brandName} = getRuntimeConfig();
  const logoSrc = getBrandLogoSrc();
  const displayBrand = brandName?.trim() ? `${brandName} Admin` : t('appTitle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [step, setStep] = useState<Step>({name: 'credentials'});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const shellProps = {
    brandName: displayBrand,
    logoSrc,
  };

  const onCredentials = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await beginLogin(email.trim(), password);
      if (result.kind === 'session') {
        navigate('/', {replace: true});
        return;
      }
      if (result.kind === 'mfa') {
        setPassword('');
        setStep({
          name: 'mfa',
          mfaToken: result.mfaToken,
          email: result.email,
        });
        setMfaCode('');
        return;
      }
      setPassword('');
      setStep({
        name: 'mfa_setup',
        mfaToken: result.mfaToken,
        email: result.email,
        secret: result.secret,
        qrCodeDataUrl: result.qrCodeDataUrl,
      });
      setMfaCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const onMfa = async (event: FormEvent) => {
    event.preventDefault();
    if (step.name === 'credentials') return;
    setError(null);
    setLoading(true);
    try {
      if (step.name === 'mfa_setup') {
        await completeMfaSetup(step.mfaToken, mfaCode.trim());
      } else {
        await completeMfaVerify(step.mfaToken, mfaCode.trim());
      }
      navigate('/', {replace: true});
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const backToCredentials = () => {
    setStep({name: 'credentials'});
    setMfaCode('');
    setError(null);
  };

  if (step.name === 'mfa_setup') {
    return (
      <LoginShell testId="login-mfa-setup" onSubmit={onMfa} {...shellProps}>
        <LoginBrand
          title={t('mfaSetupTitle')}
          subtitle={t('mfaSetupLead')}
          logoSrc={logoSrc}
        />
        {error ? <p className="login-error">{error}</p> : null}
        <div className="mfa-qr-wrap">
          <img
            className="mfa-qr"
            src={step.qrCodeDataUrl}
            alt="Authenticator QR code"
          />
        </div>
        <p className="mfa-secret-label">{t('mfaManualSecret')}</p>
        <code className="mfa-secret">{step.secret}</code>
        <div className="field">
          <label htmlFor="mfa-code">{t('mfaCode')}</label>
          <input
            id="mfa-code"
            data-testid="mfa-code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>
        <button
          className="login-submit"
          type="submit"
          disabled={loading || mfaCode.length !== 6}>
          {loading ? t('signingIn') : t('mfaEnableAndSignIn')}
        </button>
        <button
          type="button"
          className="login-back"
          onClick={backToCredentials}>
          {t('back')}
        </button>
      </LoginShell>
    );
  }

  if (step.name === 'mfa') {
    return (
      <LoginShell testId="login-mfa" onSubmit={onMfa} {...shellProps}>
        <LoginBrand
          title={t('mfaVerifyTitle')}
          subtitle={t('mfaVerifyLead')}
          logoSrc={logoSrc}
        />
        {error ? <p className="login-error">{error}</p> : null}
        <div className="field">
          <label htmlFor="mfa-code">{t('mfaCode')}</label>
          <input
            id="mfa-code"
            data-testid="mfa-code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
          />
        </div>
        <button
          className="login-submit"
          type="submit"
          disabled={loading || mfaCode.length !== 6}>
          {loading ? t('signingIn') : t('signIn')}
        </button>
        <button
          type="button"
          className="login-back"
          onClick={backToCredentials}>
          {t('back')}
        </button>
      </LoginShell>
    );
  }

  return (
    <LoginShell testId="login-root" onSubmit={onCredentials} {...shellProps}>
      <LoginBrand
        title={t('loginTitle')}
        subtitle={t('loginSubtitle')}
        logoSrc={logoSrc}
      />
      {error ? <p className="login-error">{error}</p> : null}
      <div className="field">
        <label htmlFor="email">{t('email')}</label>
        <input
          id="email"
          data-testid="email-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">{t('password')}</label>
        <input
          id="password"
          data-testid="password-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button
        className="login-submit"
        data-testid="sign-in-btn"
        type="submit"
        disabled={loading}>
        {loading ? t('signingIn') : t('signIn')}
      </button>
    </LoginShell>
  );
}
