import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { RequireAuth } from './components/RequireAuth';
import { AdminShell } from './layouts/AdminShell';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { ProviderDetailPage } from './pages/ProviderDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { AdminsPage } from './pages/AdminsPage';
import { JobsPage } from './pages/JobsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CategoryEditPage } from './pages/CategoryEditPage';
import { ContactsPage } from './pages/ContactsPage';
import { ClientsPage } from './pages/ClientsPage';
import { GeographyStatesPage } from './pages/GeographyStatesPage';
import { GeographyDistrictsPage } from './pages/GeographyDistrictsPage';
import { GeographyProvidersPage } from './pages/GeographyProvidersPage';

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="providers" element={<ProvidersPage />} />
            <Route path="providers/:providerId" element={<ProviderDetailPage />} />
            <Route path="geography" element={<GeographyStatesPage />} />
            <Route
              path="geography/states/:stateId"
              element={<GeographyDistrictsPage />}
            />
            <Route
              path="geography/districts/:districtId"
              element={<GeographyProvidersPage />}
            />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="admins" element={<AdminsPage />} />
            <Route path="users" element={<Navigate to="/admins" replace />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="categories/:categoryId" element={<CategoryEditPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="clients" element={<ClientsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
