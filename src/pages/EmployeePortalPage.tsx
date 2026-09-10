import {useEffect, useState} from 'react';
import {Link, Navigate, useNavigate} from 'react-router-dom';
import {Loader} from 'sapvt-ltd-web-packages';
import {AdminBrandLogo} from '../components/AdminBrandLogo';
import {
  clearEmployeeSession,
  getEmployeeJwt,
  isEmployeeSignedIn,
} from '../lib/employeeSession';
import {
  fetchEmployeeDocumentAccess,
  fetchEmployeePortalMe,
  formatExperienceYears,
  type Employee,
  type EmployeePortalProfile,
} from '../services/api/employeesApi';
import {ApiError} from '../services/api/apiClient';
import './EmployeePortalPage.css';

function formatMoney(amount?: number) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'on_leave':
      return 'On leave';
    case 'inactive':
      return 'Inactive';
    case 'former':
      return 'Former employee';
    default:
      return status || '—';
  }
}

export function EmployeePortalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<EmployeePortalProfile | null>(null);
  const [docBusyId, setDocBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!getEmployeeJwt()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchEmployeePortalMe();
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearEmployeeSession();
          setError('Session expired. Please sign in again.');
        } else {
          setError(
            err instanceof Error ? err.message : 'Could not load your profile',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isEmployeeSignedIn() && !loading) {
    return <Navigate to="/employee/login" replace />;
  }

  const onSignOut = () => {
    clearEmployeeSession();
    navigate('/employee/login', {replace: true});
  };

  const openDocument = async (docId: string) => {
    setDocBusyId(docId);
    try {
      const access = await fetchEmployeeDocumentAccess(docId);
      window.open(access.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not open this document. Try again.',
      );
    } finally {
      setDocBusyId(null);
    }
  };

  const employee: Employee | undefined = profile?.employee;
  const caps = profile?.capabilities;

  return (
    <div className="emp-portal">
      <header className="emp-portal__top">
        <div className="emp-portal__brand">
          <AdminBrandLogo className="emp-portal__logo" />
          <div>
            <p className="emp-portal__eyebrow">Akansho Employee Portal</p>
            <h1>Welcome{employee?.fullName ? `, ${employee.fullName}` : ''}</h1>
          </div>
        </div>
        <button type="button" className="emp-portal__signout" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      {loading ? (
        <div className="emp-portal__state">
          <Loader />
          <p>Loading your profile…</p>
        </div>
      ) : null}

      {error ? (
        <div className="emp-portal__state emp-portal__state--error" role="alert">
          <p>{error}</p>
          <Link to="/employee/login">Back to sign in</Link>
        </div>
      ) : null}

      {!loading && !error && employee ? (
        <main className="emp-portal__main">
          <section className="emp-portal__card emp-portal__summary">
            <div className="emp-portal__photo">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt="" />
              ) : (
                <span aria-hidden>
                  {(employee.fullName || '?').trim().slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="emp-portal__summary-body">
              <h2>{employee.fullName}</h2>
              <p className="emp-portal__muted">
                {employee.designation || employee.profession || 'Employee'}
              </p>
              <dl className="emp-portal__facts">
                <div>
                  <dt>Employee ID</dt>
                  <dd>{employee.employeeCode}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{employee.department || '—'}</dd>
                </div>
                <div>
                  <dt>Work location</dt>
                  <dd>{employee.workLocation || '—'}</dd>
                </div>
                <div>
                  <dt>Employment status</dt>
                  <dd>{statusLabel(employee.status)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="emp-portal__grid">
            <article className="emp-portal__card">
              <h3>My profile</h3>
              <dl className="emp-portal__dl">
                <div>
                  <dt>Email</dt>
                  <dd>{employee.email || '—'}</dd>
                </div>
                <div>
                  <dt>Profession</dt>
                  <dd>{employee.profession || '—'}</dd>
                </div>
                <div>
                  <dt>Experience</dt>
                  <dd>
                    {formatExperienceYears(employee.professionalExperienceYears)}
                  </dd>
                </div>
                <div>
                  <dt>Profile access</dt>
                  <dd>
                    {caps?.profileAccess === 'edit' ? 'View & edit' : 'View only'}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="emp-portal__card">
              <h3>Employment</h3>
              <dl className="emp-portal__dl">
                <div>
                  <dt>Type</dt>
                  <dd>{(employee.employmentType || '—').replace(/_/g, ' ')}</dd>
                </div>
                <div>
                  <dt>Joining date</dt>
                  <dd>
                    {employee.joiningDate
                      ? new Date(employee.joiningDate).toLocaleDateString()
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Reporting manager</dt>
                  <dd>{employee.reportingManagerName || '—'}</dd>
                </div>
              </dl>
            </article>

            {caps?.canViewCompensation ? (
              <article className="emp-portal__card">
                <h3>Compensation</h3>
                {profile?.currentCompensation ? (
                  <p className="emp-portal__salary">
                    {formatMoney(profile.currentCompensation.amount)}{' '}
                    <span className="emp-portal__muted">
                      / {profile.currentCompensation.salaryType || 'month'}
                    </span>
                  </p>
                ) : (
                  <p className="emp-portal__muted">No compensation on file.</p>
                )}
              </article>
            ) : null}

            {caps?.canRaiseRequest ? (
              <article className="emp-portal__card">
                <h3>HR requests</h3>
                <p className="emp-portal__muted">
                  You can raise HR requests with Akansho. Contact HR or support
                  to start a request.
                </p>
                {profile?.supportEmail ? (
                  <a
                    className="emp-portal__link"
                    href={`mailto:${profile.supportEmail}`}>
                    Email {profile.supportEmail}
                  </a>
                ) : null}
              </article>
            ) : null}

            {caps?.canViewIdCard ? (
              <article className="emp-portal__card">
                <h3>ID card</h3>
                <p className="emp-portal__muted">
                  Your official Akansho employee ID card is managed by HR. Ask HR
                  if you need a printed or digital copy.
                </p>
              </article>
            ) : null}

            {caps?.canViewDocuments ? (
              <article className="emp-portal__card emp-portal__card--wide">
                <h3>Documents</h3>
                {(employee.documents || []).length === 0 ? (
                  <p className="emp-portal__muted">No documents uploaded yet.</p>
                ) : (
                  <ul className="emp-portal__docs">
                    {(employee.documents || []).map((doc) => (
                      <li key={doc._id}>
                        <div>
                          <strong>{doc.type.replace(/_/g, ' ')}</strong>
                          <span className="emp-portal__muted">
                            {doc.fileName || doc.label || ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="emp-portal__linkbtn"
                          disabled={docBusyId === doc._id}
                          onClick={() => void openDocument(doc._id)}>
                          {docBusyId === doc._id ? 'Opening…' : 'View'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ) : null}

            {(employee.activity || []).length > 0 ? (
              <article className="emp-portal__card emp-portal__card--wide">
                <h3>Recent activity</h3>
                <ul className="emp-portal__activity">
                  {(employee.activity || []).slice(0, 8).map((row, idx) => (
                    <li key={row._id || `${row.createdAt}-${idx}`}>
                      <strong>{row.summary}</strong>
                      <span className="emp-portal__muted">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}
          </section>
        </main>
      ) : null}
    </div>
  );
}
