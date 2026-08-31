import {Navigate, NavLink, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {usePermissions} from '../hooks/usePermissions';
import {PERMISSIONS} from '../constants/permissions';
import {ContactPrivacySettings} from '../components/permissions/ContactPrivacySettings';
import {PartnerVerificationSettings} from '../components/permissions/PartnerVerificationSettings';
import {ProviderOpenRequestsSettings} from '../components/permissions/ProviderOpenRequestsSettings';
import {JobCommentsSettings} from '../components/permissions/JobCommentsSettings';
import '../styles/pages.css';
import './PermissionsPage.css';

export type PermissionsTabId =
  | 'contact-privacy'
  | 'partner-verification'
  | 'open-requests'
  | 'job-chat';

const TAB_DEFS: Array<{
  id: PermissionsTabId;
  labelKey: string;
  permission: string;
}> = [
  {
    id: 'contact-privacy',
    labelKey: 'permissionsTabContactPrivacy',
    permission: PERMISSIONS.CONTACTS_VIEW,
  },
  {
    id: 'partner-verification',
    labelKey: 'permissionsTabPartnerVerification',
    permission: PERMISSIONS.PROVIDERS_VIEW,
  },
  {
    id: 'open-requests',
    labelKey: 'permissionsTabOpenRequests',
    permission: PERMISSIONS.PROVIDERS_VIEW,
  },
  {
    id: 'job-chat',
    labelKey: 'permissionsTabJobChat',
    permission: PERMISSIONS.JOBS_VIEW,
  },
];

export function firstAllowedPermissionsTab(
  canAccess: (permission: string) => boolean,
): PermissionsTabId | null {
  for (const tab of TAB_DEFS) {
    if (canAccess(tab.permission)) return tab.id;
  }
  return null;
}

export function PermissionsIndexRedirect() {
  const {canAccess} = usePermissions();
  const tab = firstAllowedPermissionsTab(canAccess);
  if (!tab) return <Navigate to="/" replace />;
  return <Navigate to={`/settings/permissions/${tab}`} replace />;
}

export function PermissionsPage() {
  const {t} = useTranslation();
  const {canAccess} = usePermissions();
  const {tab} = useParams<{tab?: string}>();

  const visibleTabs = TAB_DEFS.filter((item) => canAccess(item.permission));
  const defaultTab = visibleTabs[0]?.id ?? null;
  const activeTab =
    visibleTabs.find((item) => item.id === tab)?.id ?? defaultTab;

  if (!defaultTab) {
    return <Navigate to="/" replace />;
  }

  if (!tab || tab !== activeTab) {
    return <Navigate to={`/settings/permissions/${activeTab}`} replace />;
  }

  return (
    <div className="admin-page scale-baseline-80" data-testid="permissions-root">
      <header className="page-header">
        <h1>{t('permissionsTitle')}</h1>
        <p>{t('permissionsLead')}</p>
      </header>

      <div
        className="permissions-tabs"
        role="tablist"
        aria-label={t('permissionsTitle')}>
        {visibleTabs.map((item) => (
          <NavLink
            key={item.id}
            to={`/settings/permissions/${item.id}`}
            role="tab"
            aria-selected={item.id === activeTab}
            className={({isActive}) =>
              isActive ? 'permissions-tab is-active' : 'permissions-tab'
            }>
            {t(item.labelKey)}
          </NavLink>
        ))}
      </div>

      <div
        className="permissions-tab-panel"
        role="tabpanel"
        aria-labelledby={`permissions-tab-${activeTab}`}>
        {activeTab === 'contact-privacy' ? <ContactPrivacySettings /> : null}
        {activeTab === 'partner-verification' ? (
          <PartnerVerificationSettings />
        ) : null}
        {activeTab === 'open-requests' ? <ProviderOpenRequestsSettings /> : null}
        {activeTab === 'job-chat' ? <JobCommentsSettings /> : null}
      </div>
    </div>
  );
}
