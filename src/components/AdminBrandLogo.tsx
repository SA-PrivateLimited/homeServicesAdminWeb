import {useEffect, useState} from 'react';
import {
  getBrandLogoSrc,
  RUNTIME_BRANDING_EVENT,
} from '../config/runtime';

const FALLBACK_LOGO = '/logo.png';

function handleLogoError(img: HTMLImageElement, hide: () => void) {
  if (img.src.endsWith(FALLBACK_LOGO) || img.src.endsWith(`${FALLBACK_LOGO}?`)) {
    hide();
    return;
  }
  img.onerror = null;
  img.src = FALLBACK_LOGO;
}

export function AdminBrandLogo({
  className,
  width = 64,
  height = 64,
  src,
}: {
  className?: string;
  width?: number;
  height?: number;
  src?: string;
}) {
  const [logoSrc, setLogoSrc] = useState(() => src || getBrandLogoSrc());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => {
      setHidden(false);
      setLogoSrc(src || getBrandLogoSrc());
    };
    sync();
    if (src) return;
    window.addEventListener(RUNTIME_BRANDING_EVENT, sync);
    return () => window.removeEventListener(RUNTIME_BRANDING_EVENT, sync);
  }, [src]);

  if (hidden) return null;

  return (
    <img
      className={className}
      src={logoSrc}
      alt=""
      width={width}
      height={height}
      onError={(e) => handleLogoError(e.currentTarget, () => setHidden(true))}
    />
  );
}
