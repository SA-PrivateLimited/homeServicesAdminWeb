import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Loader} from 'sapvt-ltd-web-packages';
import {getEmpApiUrl} from '../config/runtime';
import {resolveEmpRemoteEntryUrl} from '../emp/remoteUrl';
import {loadFederatedEmployeeManagement} from '../emp/loadRemote';
import './EmployeeManagementPage.css';

type BoundaryState = {failed: boolean; detail: string};

class EmployeeRemoteBoundary extends Component<
  {onRetry: () => void; children: ReactNode},
  BoundaryState
> {
  constructor(props: {onRetry: () => void; children: ReactNode}) {
    super(props);
    this.state = {failed: false, detail: ''};
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      failed: true,
      detail: error.message || 'Unable to load Employee Management.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Employee Management remote failed', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <EmployeeLoadError
          onRetry={this.props.onRetry}
          detail={this.state.detail}
        />
      );
    }
    return this.props.children;
  }
}

function EmployeeLoadError({
  onRetry,
  detail,
}: {
  onRetry: () => void;
  detail?: string | null;
}) {
  const {t} = useTranslation();
  return (
    <div className="emp-host-state" role="alert">
      <h1>{t('empLoadTitle')}</h1>
      <p>{detail?.trim() || t('empLoadError')}</p>
      <Button variant="primary" onClick={onRetry}>
        {t('empRetry')}
      </Button>
    </div>
  );
}

function EmployeeLoading() {
  const {t} = useTranslation();
  return (
    <div className="emp-host-state">
      <Loader label={t('empLoading')} />
    </div>
  );
}

async function assertRemoteEntry() {
  const url = resolveEmpRemoteEntryUrl();
  let response: Response;
  try {
    response = await fetch(url, {cache: 'no-store'});
  } catch {
    throw new Error(
      `Cannot reach Employee Management remote (${url}). Start employee-management-web (npm run dev or npm run preview:remote).`,
    );
  }
  const type = response.headers.get('content-type') || '';
  if (!response.ok || type.includes('text/html')) {
    throw new Error(
      `Employee Management remoteEntry.js is missing at ${url}. In employee-management-web run npm run build, then restart npm run dev.`,
    );
  }
}

/**
 * Loads the federated Employee Management module.
 * HR auth uses employee-management company credentials inside the remote —
 * not Akansho Admin login.
 */
export function EmployeeManagementPage() {
  const {t, i18n} = useTranslation();
  const [remoteReady, setRemoteReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const RemoteEmployeeManagement = useMemo(
    () => lazy(() => loadFederatedEmployeeManagement()),
    [nonce],
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRemoteReady(false);
    void (async () => {
      try {
        await assertRemoteEntry();
        if (!cancelled) setRemoteReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t('empLoadError'),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce, t]);

  const onRetry = () => setNonce((n) => n + 1);

  if (error) {
    return <EmployeeLoadError onRetry={onRetry} detail={error} />;
  }

  if (!remoteReady) {
    return <EmployeeLoading />;
  }

  return (
    <EmployeeRemoteBoundary onRetry={onRetry} key={nonce}>
      <Suspense fallback={<EmployeeLoading />}>
        <RemoteEmployeeManagement
          apiBaseUrl={getEmpApiUrl()}
          locale={i18n.language}
          basePath="/hr"
          getAccessToken={async () => ''}
        />
      </Suspense>
    </EmployeeRemoteBoundary>
  );
}
