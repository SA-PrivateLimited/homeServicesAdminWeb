import {useState, type FormEvent, type ReactNode} from 'react';
import {Link, Navigate, useNavigate} from 'react-router-dom';
import {
  setEmployeeSession,
} from '../lib/employeeSession';
import {
  employeeLogin,
  employeeLoginMfa,
} from '../services/api/employeesApi';
import {AdminBrandLogo} from '../components/AdminBrandLogo';
import './LoginPage.css';

type Step =
  | {name: 'credentials'}
  | {name: 'mfa'; mfaToken: string; email: string; displayName?: string}
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
 * Employee portal login: email + password → TOTP.
 * Separate from Admin /login (does not use Admin MFA routes or admin session).
 */
export function EmployeeLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({name: 'credentials'});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onCredentials = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await employeeLogin(email.trim(), password);
      setPassword('');
      setStep({
        name: 'mfa',
        mfaToken: result.mfaToken,
        email: result.email,
        displayName: result.displayName,
      });
      setMfaCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
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
      const result = await employeeLoginMfa(step.mfaToken, code);
      setEmployeeSession(result.accessToken, result.employee);
      navigate('/employee/portal', {replace: true});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid authenticator code',
      );
    } finally {
      setLoading(false);
    }
  };

  if (step.name === 'done') {
    return <Navigate to="/employee/portal" replace />;
  }

  if (step.name === 'mfa') {
    return (
      <Shell testId="employee-login-mfa" onSubmit={onMfa}>
        <div className="login-brand">
          <AdminBrandLogo className="login-brand-logo" />
          <h1>Authenticator code</h1>
          <p className="sub">
            {step.displayName ? `${step.displayName} · ` : ''}
            {step.email}
          </p>
          <p className="sub">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <label>
          Authenticator code
          <input
            className="text-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            autoFocus
          />
        </label>
        <button
          type="submit"
          className="login-submit"
          disabled={loading || mfaCode.length !== 6}>
          {loading ? 'Verifying…' : 'Sign in'}
        </button>
        <button
          type="button"
          className="login-back"
          onClick={() => {
            setStep({name: 'credentials'});
            setMfaCode('');
            setError(null);
          }}>
          Back
        </button>
      </Shell>
    );
  }

  return (
    <Shell testId="employee-login" onSubmit={onCredentials}>
      <div className="login-brand">
        <AdminBrandLogo className="login-brand-logo" />
        <h1>Employee sign in</h1>
        <p className="sub">
          Use your work email, password, and authenticator app. This is not the
          Admin login.
        </p>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <label>
        Email
        <input
          className="text-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          className="text-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit" className="login-submit" disabled={loading}>
        {loading ? 'Checking…' : 'Continue'}
      </button>
      <p className="sub" style={{marginTop: 12}}>
        New invite?{' '}
        <Link className="primary-link" to="/employee/activate">
          Activate account
        </Link>
      </p>
    </Shell>
  );
}
