/**
 * Icon button that copies text and briefly shows a green check on success.
 */

import {useEffect, useRef, useState} from 'react';
import {Button, Icon} from 'sapvt-ltd-web-packages';
import {copyToClipboard} from '../utils/clipboard';

type CopyFeedbackButtonProps = {
  text: string;
  ariaLabel: string;
  title?: string;
  disabled?: boolean;
  feedbackMs?: number;
  iconSize?: number;
};

export function CopyFeedbackButton({
  text,
  ariaLabel,
  title,
  disabled = false,
  feedbackMs = 1600,
  iconSize = 16,
}: CopyFeedbackButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const onCopy = async () => {
    if (disabled || !text) return;
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, feedbackMs);
  };

  return (
    <Button
      variant="ghost"
      className={`icon-only${copied ? ' copy-feedback-ok' : ''}`}
      disabled={disabled || !text}
      aria-label={copied ? 'Copied' : ariaLabel}
      title={copied ? 'Copied' : title || ariaLabel}
      onClick={() => void onCopy()}>
      <Icon
        name={copied ? 'check_circle' : 'content_copy'}
        size={iconSize}
      />
    </Button>
  );
}
