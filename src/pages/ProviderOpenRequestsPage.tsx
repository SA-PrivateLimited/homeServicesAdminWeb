import {Navigate} from 'react-router-dom';

/** @deprecated Use /settings/permissions/open-requests */
export function ProviderOpenRequestsPage() {
  return <Navigate to="/settings/permissions/open-requests" replace />;
}
