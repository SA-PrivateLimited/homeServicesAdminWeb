import {Navigate} from 'react-router-dom';

/** @deprecated Use /settings/permissions/contact-privacy */
export function ContactPrivacyPage() {
  return <Navigate to="/settings/permissions/contact-privacy" replace />;
}
