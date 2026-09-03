import {useState} from 'react';

type Props = {
  secret: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
};

export function MfaManualSecret({
  secret,
  label,
  copyLabel,
  copiedLabel,
}: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
    } catch {
      const el = document.createElement('textarea');
      el.value = secret;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mfa-secret-block">
      <p className="mfa-secret-label">{label}</p>
      <div className="mfa-secret-row">
        <code className="mfa-secret" data-testid="mfa-manual-secret">
          {secret}
        </code>
        <button
          type="button"
          className="mfa-secret-copy"
          data-testid="mfa-copy-secret"
          onClick={() => void onCopy()}>
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </div>
  );
}
