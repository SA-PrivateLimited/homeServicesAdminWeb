import {useEffect, useState, type FormEvent} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {Button, Loader} from 'sapvt-ltd-web-packages';
import {
  activationSetPassword,
  activationVerifyMfa,
  validateActivationToken,
} from '../services/api/activationApi';
import {getBrandLogoSrc} from '../config/runtime';
import './LoginPage.css';

const MIN_PASSWORD_LENGTH = 8;

type Step =
  | {name: 'loading'}
  | {name: 'invalid'; message: string}
  | {name: 'password'; email: string; displayName?: string | null}
  | {
      name: 'mfa';
      email: string;
      secret: string;
      qrCodeDataUrl: string;
      activationMfaToken: string;
    }
  | {name: 'done'};

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (searchParams.get('token') || '').trim();

  const [step, setStep] = useState<Step>({name: 'loading'});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStep({
        name: 'invalid',
        message: 'Missing activation token. Ask a Super Admin for a new link.',
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await validateActivationToken(token);
        if (cancelled) return;
        setStep({
          name: 'password',
          email: data.email,
          displayName: data.name,
        });
      } catch (err) {
        if (cancelled) return;
        setStep({
          name: 'invalid',
          message:
            err instanceof Error
              ? err.message
              : 'This activation link is invalid or expired.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await activationSetPassword({
        token,
        password,
        confirmPassword,
      });
      setPassword('');
      setConfirmPassword('');
      setStep({
        name: 'mfa',
        email: data.email,
        secret: data.secret,
        qrCodeDataUrl: data.qrCodeDataUrl,
        activationMfaToken: data.activationMfaToken,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set password');
    } finally {
      setLoading(false);
    }
  };

  const onMfa = async (event: FormEvent) => {
    event.preventDefault();
    if (step.name !== 'mfa') return;
    setError(null);
    const code = mfaCode.replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setLoading(true);
    try {
      await activationVerifyMfa({
        activationMfaToken: step.activationMfaToken,
        code,
      });
      setStep({name: 'done'});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid authenticator code',
      );
    } finally {
      setLoading(false);
    }
  };

  if (step.name === 'loading') {
    return (
      <div className="login-page scale-baseline-80">
        <div className="login-card" data-testid="activate-loading">
          <Loader label="Loading…" />
        </div>
      </div>
    );
  }

  if (step.name === 'invalid') {
    return (
      <div className="login-page scale-baseline-80">
        <div className="login-card" data-testid="activate-invalid">
          <div className="login-brand">
            <img
              className="login-brand-logo"
              src={getBrandLogoSrc()}
              alt=""
              width={64}
              height={64}
            />
            <h1>Link unavailable</h1>
            <p className="sub">{step.message}</p>
          </div>
          <Link className="hs-btn hs-btn--primary hs-btn--md" to="/login">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (step.name === 'done') {
    return (
      <div className="login-page scale-baseline-80">
        <div className="login-card" data-testid="activate-done">
          <div className="login-brand">
            <img
              className="login-brand-logo"
              src={getBrandLogoSrc()}
              alt=""
              width={64}
              height={64}
            />
            <h1>Account activated</h1>
            <p className="sub">
              You can sign in with your email, password, and authenticator code.
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/login', {replace: true})}>
            Continue to sign in
          </Button>
        </div>
      </div>
    );
  }

  if (step.name === 'mfa') {
    return (
      <div className="login-page scale-baseline-80">
        <form
          className="login-card"
          onSubmit={(e) => void onMfa(e)}
          data-testid="activate-mfa">
          <div className="login-brand">
            <img
              className="login-brand-logo"
              src={getBrandLogoSrc()}
              alt=""
              width={64}
              height={64}
            />
            <h1>Set up authenticator</h1>
            <p className="sub">
              Scan this QR with Google Authenticator (or similar), then enter
              the 6-digit code for {step.email}.
            </p>
          </div>
          <div className="mfa-qr-wrap">
            <img
              src={step.qrCodeDataUrl}
              alt="Authenticator QR code"
              width={220}
              height={220}
            />
          </div>
          <p className="muted compact secret-hint">
            Manual key: <code>{step.secret}</code>
          </p>
          <label>
            Authenticator code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={mfaCode}
              onChange={(e) =>
                setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              required
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Verifying…' : 'Activate account'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-page scale-baseline-80">
      <form
        className="login-card"
        onSubmit={(e) => void onPassword(e)}
        data-testid="activate-password">
        <div className="login-brand">
          <img
            className="login-brand-logo"
            src={getBrandLogoSrc()}
            alt=""
            width={64}
            height={64}
          />
          <h1>Activate admin account</h1>
          <p className="sub">
            {step.displayName
              ? `Welcome, ${step.displayName}. Create a password for ${step.email}.`
              : `Create a password for ${step.email}.`}
          </p>
        </div>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </div>
  );
}
