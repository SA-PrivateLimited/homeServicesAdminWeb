import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {Loader} from 'sapvt-ltd-web-packages';
import {AdminBrandLogo} from '../components/AdminBrandLogo';
import {
  fetchEmployeePublicVerification,
  type EmployeePublicVerification,
} from '../services/api/employeesApi';
import './EmployeeVerifyPage.css';

function titleFor(state: string, verified: boolean): string {
  switch (state) {
    case 'valid':
      return verified ? 'Verified' : 'Verification failed';
    case 'revoked':
      return 'ID card revoked';
    case 'expired':
      return 'ID card expired';
    case 'former':
      return 'Former employee';
    case 'inactive':
      return 'Employment inactive';
    default:
      return 'Verification failed';
  }
}

export function EmployeeVerifyPage() {
  const {token = ''} = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EmployeePublicVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEmployeePublicVerification(token.trim());
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) {
          setError('Something went wrong while verifying this ID card.');
          setData({
            verified: false,
            verificationState: 'invalid',
            message: 'This ID card could not be verified.',
            supportEmail: 'support@akansho.com',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const state = data?.verificationState || 'invalid';
  const verified = Boolean(data?.verified);
  const tone =
    state === 'valid'
      ? 'ok'
      : state === 'former' || state === 'inactive'
        ? 'warn'
        : 'bad';

  const support =
    data?.supportEmail || 'support@akansho.com';
  const emp = data?.employee;
  const verifiedOn = data?.verifiedAt
    ? new Date(data.verifiedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="emp-verify">
      <div className="emp-verify__shell">
        <header className="emp-verify__brand">
          <AdminBrandLogo className="emp-verify__logo" />
          <p className="emp-verify__org">Akansho</p>
          <h1>Employee verification</h1>
        </header>

        {loading ? (
          <div className="emp-verify__state">
            <Loader />
            <p>Verifying ID card…</p>
          </div>
        ) : null}

        {!loading && (data || error) ? (
          <>
            <div
              className={`emp-verify__badge emp-verify__badge--${tone}`}
              role="status">
              <span className="emp-verify__badge-mark" aria-hidden>
                {tone === 'ok' ? '✓' : tone === 'warn' ? '!' : '✕'}
              </span>
              <div>
                <strong>{titleFor(state, verified)}</strong>
                <p>{data?.message || error}</p>
              </div>
            </div>

            {emp && (verified || state === 'former' || state === 'inactive') ? (
              <section className="emp-verify__card">
                <div className="emp-verify__photo">
                  {emp.photoUrl ? (
                    <img src={emp.photoUrl} alt="" />
                  ) : (
                    <span aria-hidden>
                      {(emp.name || '?').trim().slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <h2>{emp.name}</h2>
                <dl className="emp-verify__dl">
                  <div>
                    <dt>Employee ID</dt>
                    <dd>{emp.employeeId}</dd>
                  </div>
                  <div>
                    <dt>Designation</dt>
                    <dd>{emp.designation || '—'}</dd>
                  </div>
                  <div>
                    <dt>Department</dt>
                    <dd>{emp.department || '—'}</dd>
                  </div>
                  <div>
                    <dt>Work location</dt>
                    <dd>{emp.workLocation || '—'}</dd>
                  </div>
                  <div>
                    <dt>Employment status</dt>
                    <dd>{(data?.employmentStatus || '—').replace(/_/g, ' ')}</dd>
                  </div>
                  <div>
                    <dt>ID card status</dt>
                    <dd>{(data?.idCardStatus || '—').replace(/_/g, ' ')}</dd>
                  </div>
                  {verifiedOn ? (
                    <div>
                      <dt>Verified on</dt>
                      <dd>{verifiedOn}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            <footer className="emp-verify__support">
              <p>Need help verifying this ID?</p>
              <a href={`mailto:${support}`}>Contact Akansho Support</a>
              <p className="emp-verify__email">{support}</p>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}
