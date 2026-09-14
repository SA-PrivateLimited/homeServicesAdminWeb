import {Component, type ErrorInfo, type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Button} from 'sapvt-ltd-web-packages';

type BoundaryProps = {
  children: ReactNode;
  resetKey: string;
  employee?: boolean;
};

type BoundaryState = {
  failed: boolean;
  detail: string;
};

/**
 * Keeps Admin sidebar/tabs alive when a section (especially Employee) throws.
 * Resets when `resetKey` changes so other routes still render.
 */
export class AdminSectionErrorBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = {failed: false, detail: ''};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      failed: true,
      detail: error.message || '',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin section failed', error, info);
  }

  componentDidUpdate(prevProps: BoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({failed: false, detail: ''});
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <AdminSectionErrorFallback
          employee={Boolean(this.props.employee)}
          detail={this.state.detail}
          onRetry={() => this.setState({failed: false, detail: ''})}
        />
      );
    }
    return this.props.children;
  }
}

function AdminSectionErrorFallback({
  employee,
  detail,
  onRetry,
}: {
  employee: boolean;
  detail: string;
  onRetry: () => void;
}) {
  const {t} = useTranslation();
  return (
    <div className="admin-section-error" role="alert">
      <h1>{employee ? t('empLoadTitle') : t('adminSectionError')}</h1>
      <p>{detail.trim() || (employee ? t('empLoadError') : t('adminSectionError'))}</p>
      <p className="admin-section-error-hint">{t('adminSectionErrorHint')}</p>
      <Button variant="primary" onClick={onRetry}>
        {t('empRetry')}
      </Button>
    </div>
  );
}

/** Wrap AdminShell `<Outlet />` so a crash in one tab does not unmount the shell. */
export function AdminOutletErrorBoundary({children}: {children: ReactNode}) {
  const {pathname} = useLocation();
  const employee = pathname.startsWith('/hr') || pathname.startsWith('/employees');
  return (
    <AdminSectionErrorBoundary resetKey={pathname} employee={employee}>
      {children}
    </AdminSectionErrorBoundary>
  );
}

export function EmployeeRouteBoundary({children}: {children: ReactNode}) {
  return (
    <AdminSectionErrorBoundary resetKey="hr" employee>
      {children}
    </AdminSectionErrorBoundary>
  );
}
