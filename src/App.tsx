import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { RequireAuth } from './components/RequireAuth';
import { RequirePermission } from './components/RequirePermission';
import { RequireSuperAdmin } from './components/RequireSuperAdmin';
import { AdminShell } from './layouts/AdminShell';
import { LoginPage } from './pages/LoginPage';
import { ActivatePage } from './pages/ActivatePage';
import { OverviewPage } from './pages/OverviewPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { PartnerBulkOnboardingPage } from './pages/PartnerBulkOnboardingPage';
import { ProviderDetailPage } from './pages/ProviderDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { AdminsPage } from './pages/AdminsPage';
import { JobsPage } from './pages/JobsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CategoryEditPage } from './pages/CategoryEditPage';
import { CategorySectionsPage } from './pages/CategorySectionsPage';
import { ContactsPage } from './pages/ContactsPage';
import { FeedbacksPage } from './pages/FeedbacksPage';
import { ContactPrivacyPage } from './pages/ContactPrivacyPage';
import { PartnerVerificationPage } from './pages/PartnerVerificationPage';
import { ProviderOpenRequestsPage } from './pages/ProviderOpenRequestsPage';
import { PermissionsPage, PermissionsIndexRedirect } from './pages/PermissionsPage';
import { ClientsPage } from './pages/ClientsPage';
import { GreetingPage } from './pages/GreetingPage';
import { DatabaseBackupPage } from './pages/DatabaseBackupPage';
import { BrandCreativesPage } from './pages/BrandCreativesPage';
import { GeographyStatesPage } from './pages/GeographyStatesPage';
import { GeographyDistrictsPage } from './pages/GeographyDistrictsPage';
import { GeographyProvidersPage } from './pages/GeographyProvidersPage';
import { PERMISSIONS } from './constants/permissions';

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activate" element={<ActivatePage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminShell />}>
            <Route
              element={
                <RequirePermission permission={PERMISSIONS.OVERVIEW_VIEW} />
              }>
              <Route index element={<OverviewPage />} />
            </Route>
            <Route
              element={
                <RequirePermission permission={PERMISSIONS.PROVIDERS_VIEW} />
              }>
              <Route path="providers" element={<ProvidersPage />} />
              <Route
                path="partners/bulk-onboarding"
                element={<PartnerBulkOnboardingPage />}
              />
              <Route
                path="providers/:providerId"
                element={<ProviderDetailPage />}
              />
              <Route
                path="settings/partner-verification"
                element={<PartnerVerificationPage />}
              />
              <Route
                path="settings/provider-open-requests"
                element={<ProviderOpenRequestsPage />}
              />
            </Route>
            <Route
              element={
                <RequirePermission
                  anyOf={[
                    PERMISSIONS.PROVIDERS_VIEW,
                    PERMISSIONS.CONTACTS_VIEW,
                  ]}
                />
              }>
              <Route
                path="settings/permissions"
                element={<PermissionsIndexRedirect />}
              />
              <Route
                path="settings/permissions/:tab"
                element={<PermissionsPage />}
              />
            </Route>
            <Route
              element={
                <RequirePermission permission={PERMISSIONS.GEOGRAPHY_VIEW} />
              }>
              <Route path="geography" element={<GeographyStatesPage />} />
              <Route
                path="geography/states/:stateId"
                element={<GeographyDistrictsPage />}
              />
              <Route
                path="geography/districts/:districtId"
                element={<GeographyProvidersPage />}
              />
            </Route>
            <Route
              element={
                <RequirePermission permission={PERMISSIONS.CUSTOMERS_VIEW} />
              }>
              <Route path="customers" element={<CustomersPage />} />
            </Route>
            <Route
              element={
                <RequirePermission permission={PERMISSIONS.ADMINS_VIEW} />
              }>
              <Route path="admins" element={<AdminsPage />} />
              <Route path="users" element={<Navigate to="/admins" replace />} />
            </Route>
            <Route
              element={<RequirePermission permission={PERMISSIONS.JOBS_VIEW} />}>
              <Route path="jobs" element={<JobsPage />} />
            </Route>
            <Route
              element={
                <RequirePermission permission={PERMISSIONS.CATEGORIES_VIEW} />
              }>
              <Route path="categories" element={<CategoriesPage />} />
              <Route
                path="categories/:categoryId"
                element={<CategoryEditPage />}
              />
              <Route
                path="category-sections"
                element={<CategorySectionsPage />}
              />
            </Route>
            <Route
              element={
                <RequirePermission permission={PERMISSIONS.CONTACTS_VIEW} />
              }>
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="feedbacks" element={<FeedbacksPage />} />
              <Route
                path="settings/contact-privacy"
                element={<ContactPrivacyPage />}
              />
            </Route>
            <Route
              element={
                <RequirePermission permission={PERMISSIONS.CLIENTS_VIEW} />
              }>
              <Route path="clients" element={<ClientsPage />} />
              <Route path="greeting" element={<GreetingPage />} />
              <Route path="launch" element={<Navigate to="/greeting" replace />} />
            </Route>
            <Route element={<RequireSuperAdmin />}>
              <Route path="backups" element={<DatabaseBackupPage />} />
              <Route path="creatives" element={<BrandCreativesPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
