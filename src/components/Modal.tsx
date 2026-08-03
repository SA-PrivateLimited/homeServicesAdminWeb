import {useEffect, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from 'sapvt-ltd-web-packages';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  testId?: string;
  className?: string;
}

export function Modal({
  title,
  children,
  onClose,
  testId,
  className = '',
}: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal outside scale-baseline-* pages — fixed positioning must not nest under zoom/transform
  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid={testId ? `${testId}-backdrop` : undefined}>
      <div
        className={`modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="btn btn-ghost modal-close"
            aria-label="Close"
            onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
