import {Navigate} from 'react-router-dom';

/** @deprecated Use /settings/permissions/partner-verification */
export function PartnerVerificationPage() {
  return <Navigate to="/settings/permissions/partner-verification" replace />;
}
