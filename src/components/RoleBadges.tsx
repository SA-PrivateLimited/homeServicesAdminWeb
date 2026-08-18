import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';

type RoleBadgesProps = {
  hasCustomer?: boolean;
  hasPartner?: boolean;
  partnerId?: string;
  customerHref?: string;
};

export function RoleBadges({
  hasCustomer = false,
  hasPartner = false,
  partnerId,
  customerHref,
}: RoleBadgesProps) {
  const {t} = useTranslation();
  if (!hasCustomer && !hasPartner) return null;
  return (
    <span className="role-badges">
      {hasCustomer ? (
        customerHref ? (
          <Link className="role-badge" to={customerHref}>
            {t('roleCustomer')}
          </Link>
        ) : (
          <span className="role-badge">{t('roleCustomer')}</span>
        )
      ) : null}
      {hasPartner ? (
        partnerId ? (
          <Link className="role-badge role-badge--partner" to={`/providers/${partnerId}`}>
            {t('rolePartner')}
          </Link>
        ) : (
          <span className="role-badge role-badge--partner">{t('rolePartner')}</span>
        )
      ) : null}
    </span>
  );
}
