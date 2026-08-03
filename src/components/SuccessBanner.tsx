import {Banner} from 'sapvt-ltd-web-packages';
import {formatPhoneDisplay} from '../utils/phone';

export interface SuccessBannerContent {
  title: string;
  detail: string;
  pin?: string;
}

interface SuccessBannerProps {
  banner: SuccessBannerContent;
  onDismiss: () => void;
  testId?: string;
}

export function SuccessBanner({
  banner,
  onDismiss,
  testId = 'success-banner',
}: SuccessBannerProps) {
  return (
    <Banner
      title={banner.title}
      detail={banner.detail}
      meta={
        banner.pin ? (
          <p className="success-banner-pin">
            PIN: <code>{banner.pin}</code>
          </p>
        ) : undefined
      }
      variant="success"
      onDismiss={onDismiss}
      testId={testId}
    />
  );
}

export function userLabel(user: {
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
}): {name: string; phone: string} {
  const phone = formatPhoneDisplay(user.phone, user.phoneNumber);
  return {
    name:
      user.name ||
      user.displayName ||
      user.email ||
      (phone !== '—' ? phone : '') ||
      'this user',
    phone: phone === '—' ? '' : phone,
  };
}

export function pinSuccessBanner(
  t: (key: string, opts?: Record<string, string>) => string,
  user: {
    name?: string;
    displayName?: string;
    email?: string;
    phone?: string;
    phoneNumber?: string;
  },
  pin: string,
): SuccessBannerContent {
  const {name, phone} = userLabel(user);
  return {
    title: t('pinUpdatedTitle'),
    detail: phone
      ? t('pinUpdatedDetail', {name, phone})
      : t('pinUpdatedDetailNoPhone', {name}),
    pin,
  };
}
