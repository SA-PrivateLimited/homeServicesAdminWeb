import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {Loader} from 'sapvt-ltd-web-packages';
import {
  activationSetPassword,
  activationVerifyMfa,
  validateActivationToken,
} from '../services/api/activationApi';
import {AdminBrandLogo} from '../components/AdminBrandLogo';
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

function ActivateBrand({title, subtitle}: {title: string; subtitle: string}) {
  return (
    <div className="login-brand">
      <AdminBrandLogo className="login-brand-logo" />
      <h1>{title}</h1>
      <p className="sub">{subtitle}</p>
    </div>
  );
}

function ActivateShell({
  children,
  testId,
  onSubmit,
}: {
  children: ReactNode;
  testId: string;
  onSubmit?: (event: FormEvent) => void;
}) {
  const card = onSubmit ? (
    <form className="login-card" onSubmit={onSubmit} data-testid={testId}>
      {children}
    </form>
  ) : (
    <div className="login-card" data-testid={testId}>
      {children}
    </div>
  );

  return (
    <div className="login-layout login-layout--solo">
      <div className="login-form-pane">{card}</div>
    </div>
  );
}

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (searchParams.get('token') || '').trim();

  const [step, setStep] = useState<Step>({name: 'loading'});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      <ActivateShell testId="activate-loading">
        <Loader label="Loading…" />
      </ActivateShell>
    );
  }

  if (step.name === 'invalid') {
    return (
      <ActivateShell testId="activate-invalid">
        <ActivateBrand title="Link unavailable" subtitle={step.message} />
        <Link className="login-submit" to="/login">
          Go to sign in
        </Link>
      </ActivateShell>
    );
  }

  if (step.name === 'done') {
    return (
      <ActivateShell testId="activate-done">
        <ActivateBrand
          title="Account activated"
          subtitle="You can sign in with your email, password, and authenticator code."
        />
        <button
          className="login-submit"
          type="button"
          onClick={() => navigate('/login', {replace: true})}>
          Continue to sign in
        </button>
      </ActivateShell>
    );
  }

  if (step.name === 'mfa') {
    return (
      <ActivateShell testId="activate-mfa" onSubmit={onMfa}>
        <ActivateBrand
          title="Set up authenticator"
          subtitle={`Scan this QR with Google Authenticator (or similar), then enter the 6-digit code for ${step.email}.`}
        />
        <div className="mfa-qr-wrap">
          <img
            className="mfa-qr"
            src={step.qrCodeDataUrl}
            alt="Authenticator QR code"
          />
        </div>
        <p className="mfa-secret-label">Manual key</p>
        <code className="mfa-secret">{step.secret}</code>
        {error ? <p className="login-error">{error}</p> : null}
        <div className="field">
          <label htmlFor="activate-mfa-code">Authenticator code</label>
          <input
            id="activate-mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={mfaCode}
            onChange={(e) =>
              setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            required
          />
        </div>
        <button
          className="login-submit"
          type="submit"
          disabled={loading || mfaCode.length !== 6}>
          {loading ? 'Verifying…' : 'Activate account'}
        </button>
      </ActivateShell>
    );
  }

  return (
    <ActivateShell testId="activate-password" onSubmit={onPassword}>
      <ActivateBrand
        title="Activate admin account"
        subtitle={
          step.displayName
            ? `Welcome, ${step.displayName}. Create a password for ${step.email}.`
            : `Create a password for ${step.email}.`
        }
      />
      {error ? <p className="login-error">{error}</p> : null}
      <div className="field">
        <label htmlFor="activate-password">New password</label>
        <div className="field-password">
          <input
            id="activate-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
          <button
            type="button"
            className="field-password-toggle"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <p className="field-hint">At least {MIN_PASSWORD_LENGTH} characters</p>
      <div className="field">
        <label htmlFor="activate-confirm-password">Confirm password</label>
        <div className="field-password">
          <input
            id="activate-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
          <button
            type="button"
            className="field-password-toggle"
            aria-label={
              showConfirmPassword ? 'Hide password' : 'Show password'
            }
            aria-pressed={showConfirmPassword}
            onClick={() => setShowConfirmPassword((value) => !value)}>
            {showConfirmPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <button className="login-submit" type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Continue'}
      </button>
    </ActivateShell>
  );
}
