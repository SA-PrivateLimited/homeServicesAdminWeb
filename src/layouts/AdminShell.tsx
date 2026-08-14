import {useEffect, useRef, useState} from 'react';
import {NavLink, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  Icon,
  Button,
  Dialog,
} from 'sapvt-ltd-web-packages';
import {useAuthStore} from '../store/authStore';
import {getBrandLogoSrc, getRuntimeConfig} from '../config/runtime';
import {usePermissions} from '../hooks/usePermissions';
import {PERMISSIONS} from '../constants/permissions';
import {
  adminSocketService,
  type NewServiceRequestPayload,
} from '../services/adminSocket';
import {setAppLanguage} from '../i18n';
import './AdminShell.css';

const NAV: Array<{
  to: string;
  end?: boolean;
  key: string;
  permission?: string;
  superAdminOnly?: boolean;
}> = [
  {to: '/', end: true, key: 'navOverview', permission: PERMISSIONS.OVERVIEW_VIEW},
  {to: '/providers', key: 'navProviders', permission: PERMISSIONS.PROVIDERS_VIEW},
  {to: '/geography', key: 'navGeography', permission: PERMISSIONS.GEOGRAPHY_VIEW},
  {to: '/customers', key: 'navCustomers', permission: PERMISSIONS.CUSTOMERS_VIEW},
  {
    to: '/admins',
    key: 'navAdmins',
    permission: PERMISSIONS.ADMINS_VIEW,
    superAdminOnly: true,
  },
  {to: '/jobs', key: 'navJobs', permission: PERMISSIONS.JOBS_VIEW},
  {
    to: '/categories',
    key: 'navCategories',
    permission: PERMISSIONS.CATEGORIES_VIEW,
  },
  {to: '/contacts', key: 'navContacts', permission: PERMISSIONS.CONTACTS_VIEW},
  {
    to: '/clients',
    key: 'navClients',
    permission: PERMISSIONS.CLIENTS_VIEW,
    superAdminOnly: true,
  },
];

const SIDEBAR_COLLAPSED_KEY = 'hs-admin-sidebar-collapsed';

export function AdminShell() {
  const {t, i18n} = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const elevateToSuperAdmin = useAuthStore((s) => s.elevateToSuperAdmin);
  const exitSuperAdmin = useAuthStore((s) => s.exitSuperAdmin);
  const changeSuperAdminKey = useAuthStore((s) => s.changeSuperAdminKey);
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);
  const {canAccess} = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const {brandName} = getRuntimeConfig();
  const logoSrc = getBrandLogoSrc();
  const shellTitle = brandName?.trim()
    ? `${brandName} Admin`
    : t('appTitle');
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const [elevateOpen, setElevateOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [code, setCode] = useState('');
  const [currentKey, setCurrentKey] = useState('');
  const [newKey, setNewKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobsBadge, setJobsBadge] = useState(0);
  const [requestToast, setRequestToast] = useState<NewServiceRequestPayload | null>(
    null,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        sidebarCollapsed ? '1' : '0',
      );
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const unsubscribe = adminSocketService.onNewServiceRequest((payload) => {
      setRequestToast(payload);
      if (
        !payload.needsProvidersInArea &&
        !pathRef.current.startsWith('/jobs')
      ) {
        setJobsBadge((n) => n + 1);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/jobs')) {
      setJobsBadge(0);
    }
  }, [location.pathname]);

  const onLogout = async () => {
    adminSocketService.disconnect();
    await logout();
    navigate('/login', {replace: true});
  };

  const onElevate = async () => {
    setError(null);
    setBusy(true);
    try {
      await elevateToSuperAdmin(code);
      setElevateOpen(false);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const onUpdateKey = async () => {
    setError(null);
    if (newKey !== confirmKey) {
      setError(t('superAdminKeyMismatch'));
      return;
    }
    setBusy(true);
    try {
      await changeSuperAdminKey(currentKey, newKey);
      setKeyOpen(false);
      setCurrentKey('');
      setNewKey('');
      setConfirmKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`admin-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Admin navigation">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <img
              className="sidebar-brand-logo"
              src={logoSrc}
              alt=""
              width={36}
              height={36}
            />
            {!sidebarCollapsed ? <span>{shellTitle}</span> : null}
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={
              sidebarCollapsed ? t('sidebarExpand') : t('sidebarCollapse')
            }
            aria-expanded={!sidebarCollapsed}
            title={
              sidebarCollapsed ? t('sidebarExpand') : t('sidebarCollapse')
            }
            onClick={() => setSidebarCollapsed((v) => !v)}>
            <Icon
              name={sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
              size={22}
            />
          </button>
        </div>
        {superAdminElevated && !sidebarCollapsed ? (
          <p className="superadmin-badge">{t('superAdminActive')}</p>
        ) : null}
        <nav className="sidebar-nav" aria-label="Admin">
          {NAV.filter((item) => {
            if (item.superAdminOnly && !superAdminElevated) return false;
            if (item.permission && !canAccess(item.permission)) return false;
            return true;
          }).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={Boolean(item.end)}
              className={({isActive}) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
              title={t(item.key)}>
              <span className="nav-link-abbr" aria-hidden>
                {t(item.key).charAt(0)}
              </span>
              <span className="nav-link-text">{t(item.key)}</span>
              {item.to === '/jobs' && jobsBadge > 0 ? (
                <span className="nav-link-badge" aria-label={`${jobsBadge} new`}>
                  {jobsBadge > 99 ? '99+' : jobsBadge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {superAdminElevated ? (
            <>
              <button
                type="button"
                className="logout-btn"
                title={t('updateSuperAdminKey')}
                onClick={() => {
                  setError(null);
                  setKeyOpen(true);
                }}>
                <span className="logout-btn-label">{t('updateSuperAdminKey')}</span>
                <span className="logout-btn-icon" aria-hidden>
                  <Icon name="key" size={18} />
                </span>
              </button>
              <button
                type="button"
                className="logout-btn"
                title={t('exitSuperAdmin')}
                onClick={() => {
                  exitSuperAdmin();
                  if (window.location.pathname.startsWith('/admins')) {
                    navigate('/', {replace: true});
                  }
                }}>
                <span className="logout-btn-label">{t('exitSuperAdmin')}</span>
                <span className="logout-btn-icon" aria-hidden>
                  <Icon name="logout" size={18} />
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="logout-btn superadmin-btn"
              title={t('actAsSuperAdmin')}
              onClick={() => {
                setError(null);
                setCode('');
                setElevateOpen(true);
              }}>
              <span className="logout-btn-label">{t('actAsSuperAdmin')}</span>
              <span className="logout-btn-icon" aria-hidden>
                <Icon name="admin_panel_settings" size={18} />
              </span>
            </button>
          )}
          <button
            type="button"
            className="logout-btn"
            title={t('language')}
            onClick={() =>
              setAppLanguage(i18n.language?.startsWith('hi') ? 'en' : 'hi')
            }>
            <span className="logout-btn-label">
              {t('language')}:{' '}
              {i18n.language?.startsWith('hi') ? t('langEn') : t('langHi')}
            </span>
            <span className="logout-btn-icon" aria-hidden>
              <Icon name="translate" size={18} />
            </span>
          </button>
          <button
            type="button"
            className="logout-btn"
            title={t('logout')}
            onClick={onLogout}>
            <span className="logout-btn-label">{t('logout')}</span>
            <span className="logout-btn-icon" aria-hidden>
              <Icon name="logout" size={18} />
            </span>
          </button>
        </div>
      </aside>
      <main className="shell-main">
        {requestToast ? (
          <div className="admin-request-toast" role="status">
            <div className="admin-request-toast-body">
              <strong>
                {requestToast.needsProvidersInArea
                  ? 'Provider needed in area'
                  : requestToast.needsAdminAssignment
                    ? 'Needs provider assignment'
                    : 'New service request'}
              </strong>
              <p>
                {requestToast.customerName || 'Customer'}
                {requestToast.serviceType
                  ? ` · ${requestToast.serviceType}`
                  : ''}
                {requestToast.pincode ? ` · ${requestToast.pincode}` : ''}
                {requestToast.needsProvidersInArea
                  ? ' · request more providers'
                  : requestToast.needsAdminAssignment
                    ? ' · no providers in area'
                    : ''}
              </p>
            </div>
            <div className="admin-request-toast-actions">
              <button
                type="button"
                className="admin-request-toast-btn"
                onClick={() => {
                  setRequestToast(null);
                  if (!requestToast.needsProvidersInArea) {
                    setJobsBadge(0);
                  }
                  navigate(
                    requestToast.needsProvidersInArea
                      ? '/providers'
                      : requestToast.needsAdminAssignment
                        ? '/jobs?filter=unassigned'
                        : '/jobs',
                  );
                }}>
                {requestToast.needsProvidersInArea
                  ? 'View providers'
                  : 'View jobs'}
              </button>
              <button
                type="button"
                className="admin-request-toast-dismiss"
                aria-label="Dismiss"
                onClick={() => setRequestToast(null)}>
                ×
              </button>
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>

      {elevateOpen ? (
        <Dialog open
          title={t('actAsSuperAdmin')}
          onClose={() => setElevateOpen(false)}
          testId="superadmin-elevate-modal">
          <p className="muted compact">{t('actAsSuperAdminLead')}</p>
          <label>
            {t('superAdminKey')}
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={busy || code.length !== 4} onClick={() => void onElevate()}>
              {busy ? t('saving') : t('continue')}
            </Button>
            <Button variant="ghost" onClick={() => setElevateOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {keyOpen ? (
        <Dialog open
          title={t('updateSuperAdminKey')}
          onClose={() => setKeyOpen(false)}
          testId="superadmin-key-modal">
          <p className="muted compact">{t('updateSuperAdminKeyLead')}</p>
          <label>
            {t('currentSuperAdminKey')}
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentKey}
              onChange={(e) => setCurrentKey(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label>
            {t('newSuperAdminKey')}
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label>
            {t('confirmSuperAdminKey')}
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmKey}
              onChange={(e) => setConfirmKey(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={ busy || currentKey.length !== 4 || newKey.length !== 4 || confirmKey.length !== 4 } onClick={() => void onUpdateKey()}>
              {busy ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={() => setKeyOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
