import type {ReactNode} from 'react';
import {Button, Dialog} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  type SuccessBannerContent,
} from '../SuccessBanner';

export type PolicyOption<T extends string> = {
  value: T;
  title: string;
  help: string;
};

export function PolicySettingsCard<T extends string>({
  title,
  currentLabel,
  legend,
  options,
  value,
  onChange,
  name,
  loading,
  error,
  onRetry,
  retryLabel,
  canUpdate,
  dirty,
  saving,
  onSave,
  saveLabel,
  savingLabel,
  noPermissionText,
  confirmOpen,
  confirmTitle,
  confirmBody,
  onConfirm,
  onCancelConfirm,
  continueLabel,
  cancelLabel,
  successBanner,
  onDismissBanner,
  bannerTestId,
  confirmTestId,
}: {
  title: string;
  currentLabel: string;
  legend: string;
  options: Array<PolicyOption<T>>;
  value: T;
  onChange: (value: T) => void;
  name: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  retryLabel: string;
  canUpdate: boolean;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  savingLabel: string;
  noPermissionText: string;
  confirmOpen: boolean;
  confirmTitle: string;
  confirmBody: ReactNode;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  continueLabel: string;
  cancelLabel: string;
  successBanner: SuccessBannerContent | null;
  onDismissBanner: () => void;
  bannerTestId: string;
  confirmTestId: string;
}) {
  return (
    <>
      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={onDismissBanner}
          testId={bannerTestId}
        />
      ) : null}

      <section className="panel policy-card">
        <div className="policy-card-head">
          <h2>{title}</h2>
          {!loading && !error ? (
            <span className="policy-chip">{currentLabel}</span>
          ) : null}
        </div>

        {error ? (
          <div className="policy-card-error">
            <p className="error-text">{error}</p>
            <Button variant="ghost" onClick={onRetry}>
              {retryLabel}
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="policy-skeleton" aria-hidden>
            <span />
            <span />
          </div>
        ) : error ? null : (
          <fieldset className="policy-radios" disabled={!canUpdate}>
            <legend className="sr-only">{legend}</legend>
            {options.map((option) => (
              <label
                key={option.value}
                className={
                  option.value === value
                    ? 'policy-option is-selected'
                    : 'policy-option'
                }>
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={option.value === value}
                  onChange={() => onChange(option.value)}
                />
                <span>
                  <strong>{option.title}</strong>
                  <span className="muted compact">{option.help}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="policy-card-actions">
          <Button
            variant="primary"
            disabled={!canUpdate || loading || saving || !dirty || Boolean(error)}
            onClick={onSave}>
            {saving ? savingLabel : saveLabel}
          </Button>
          {!canUpdate ? (
            <p className="muted compact">{noPermissionText}</p>
          ) : null}
        </div>
      </section>

      {confirmOpen ? (
        <Dialog
          open
          title={confirmTitle}
          onClose={onCancelConfirm}
          testId={confirmTestId}>
          <p>{confirmBody}</p>
          <div className="actions">
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void onConfirm()}>
              {saving ? savingLabel : continueLabel}
            </Button>
            <Button variant="ghost" onClick={onCancelConfirm}>
              {cancelLabel}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
