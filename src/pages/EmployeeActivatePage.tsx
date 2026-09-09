import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {Loader} from 'sapvt-ltd-web-packages';
import {
  employeeActivationSetPassword,
  employeeActivationVerifyMfa,
  validateEmployeeActivationToken,
} from '../services/api/employeesApi';
import {AdminBrandLogo} from '../components/AdminBrandLogo';
import {MfaManualSecret} from '../components/MfaManualSecret';
import './LoginPage.css';

const MIN_PASSWORD_LENGTH = 8;

type Step =
  | {name: 'loading'}
  | {name: 'invalid'; message: string}
  | {name: 'password'; email: string; displayName?: string}
  | {
      name: 'mfa';
      email: string;
      secret: string;
      qrCodeDataUrl: string;
      activationMfaToken: string;
    }
  | {name: 'done'};

function Shell({
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

/**
 * Employee invitation activation: password → TOTP.
 * Separate from Admin /activate (does not use Admin MFA routes).
 */
export function EmployeeActivatePage() {
  const [searchParams] = useSearchParams();
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
        message: 'Missing invitation token. Ask Akansho HR for a new link.',
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await validateEmployeeActivationToken(token);
        if (cancelled) return;
        setStep({
          name: 'password',
          email: data.email,
          displayName: data.displayName,
        });
      } catch (err) {
        if (cancelled) return;
        setStep({
          name: 'invalid',
          message:
            err instanceof Error
              ? err.message
              : 'This invitation is invalid or expired.',
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
      const data = await employeeActivationSetPassword(token, password);
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
      await employeeActivationVerifyMfa(step.activationMfaToken, code);
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
      <Shell testId="employee-activate-loading">
        <Loader label="Loading…" />
      </Shell>
    );
  }

  if (step.name === 'invalid') {
    return (
      <Shell testId="employee-activate-invalid">
        <div className="login-brand">
          <AdminBrandLogo className="login-brand-logo" />
          <h1>Invitation unavailable</h1>
          <p className="sub">{step.message}</p>
        </div>
      </Shell>
    );
  }

  if (step.name === 'done') {
    return (
      <Shell testId="employee-activate-done">
        <div className="login-brand">
          <AdminBrandLogo className="login-brand-logo" />
          <h1>Account activated</h1>
          <p className="sub">
            You can sign in with your email, password, and authenticator app.
          </p>
        </div>
        <Link className="primary-link" to="/employee/login">
          Sign in
        </Link>
      </Shell>
    );
  }

  if (step.name === 'mfa') {
    return (
      <Shell testId="employee-activate-mfa" onSubmit={onMfa}>
        <div className="login-brand">
          <AdminBrandLogo className="login-brand-logo" />
          <h1>Set up authenticator</h1>
          <p className="sub">
            Scan this QR with Google Authenticator or Authy, then enter the
            6-digit code. This is required for your employee account.
          </p>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <img
          src={step.qrCodeDataUrl}
          alt="Authenticator QR code"
          width={220}
          height={220}
          style={{display: 'block', margin: '0 auto 12px'}}
        />
        <MfaManualSecret
          secret={step.secret}
          label="Or enter this key manually"
          copyLabel="Copy"
          copiedLabel="Copied"
        />
        <label>
          Authenticator code
          <input
            className="text-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            maxLength={6}
          />
        </label>
        <button type="submit" className="login-submit" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify and activate'}
        </button>
      </Shell>
    );
  }

  return (
    <Shell testId="employee-activate-password" onSubmit={onPassword}>
      <div className="login-brand">
        <AdminBrandLogo className="login-brand-logo" />
        <h1>Activate employee account</h1>
        <p className="sub">
          {step.displayName ? `${step.displayName} · ` : ''}
          {step.email}
        </p>
        <p className="sub">
          Set a password, then enroll an authenticator app (TOTP).
        </p>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <label>
        Password
        <input
          className="text-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        Confirm password
        <input
          className="text-input"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </label>
      <button type="submit" className="login-submit" disabled={loading}>
        {loading ? 'Saving…' : 'Continue'}
      </button>
    </Shell>
  );
}
