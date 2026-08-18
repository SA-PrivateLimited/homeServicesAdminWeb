/**
 * Copies a PIN to clipboard by fetching it silently (without revealing it
 * in the UI). If the PIN is already revealed, copies it directly.
 *
 * Shows a brief "Copied" feedback icon on success.
 */

import {useEffect, useRef, useState} from 'react';
import {Button, Icon} from 'sapvt-ltd-web-packages';
import {copyToClipboard} from '../utils/clipboard';

type PinCopyButtonProps = {
  /** Already-revealed PIN value (if any). If provided, no fetch is needed. */
  revealedPin?: string;
  /** Async function that returns the PIN value for copying. */
  fetchPin: () => Promise<string | null>;
  ariaLabel?: string;
  title?: string;
  feedbackMs?: number;
  iconSize?: number;
};

export function PinCopyButton({
  revealedPin,
  fetchPin,
  ariaLabel = 'Copy PIN',
  title,
  feedbackMs = 1800,
  iconSize = 16,
}: PinCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const onCopy = async () => {
    if (busy) return;
    let pin = revealedPin;
    if (!pin) {
      setBusy(true);
      try {
        pin = (await fetchPin()) ?? undefined;
      } catch {
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    if (!pin) return;
    const ok = await copyToClipboard(pin);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, feedbackMs);
  };

  return (
    <Button
      variant="ghost"
      className={`icon-only${copied ? ' copy-feedback-ok' : ''}`}
      disabled={busy}
      aria-label={copied ? 'Copied' : ariaLabel}
      title={copied ? 'Copied' : title || ariaLabel}
      onClick={() => void onCopy()}>
      <Icon
        name={busy ? 'hourglass_empty' : copied ? 'check_circle' : 'content_copy'}
        size={iconSize}
      />
    </Button>
  );
}
