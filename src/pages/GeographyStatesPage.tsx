import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  VirtualTable,
  type VirtualTableColumn,
  Button,
} from 'sapvt-ltd-web-packages';
import {
  clearGeographyListCache,
  getGeographyStates,
  peekGeographyStates,
  type GeographyJobStats,
  type GeographyStateRow,
} from '../services/api/geographyApi';
import {sortByUpdatedThenCreated} from '../utils/sort';
import '../styles/pages.css';

function formatJobs(stats?: GeographyJobStats): string {
  if (!stats) return '—';
  return `${stats.completed}/${stats.pending}/${stats.cancelled}`;
}

export function GeographyStatesPage() {
  const {t} = useTranslation();
  const warm = peekGeographyStates();
  const [rows, setRows] = useState<GeographyStateRow[]>(() => warm || []);
  const [loading, setLoading] = useState(() => !warm);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: {force?: boolean}) => {
    const force = opts?.force === true;
    if (force) clearGeographyListCache();
    const cached = !force ? peekGeographyStates() : null;
    if (cached) {
      setRows(sortByUpdatedThenCreated(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setRows(sortByUpdatedThenCreated(await getGeographyStates({force})));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<VirtualTableColumn<GeographyStateRow>[]>(
    () => [
      {
        key: 'name',
        header: t('geoColState'),
        width: '22%',
        filterable: true,
        filterValue: (row) => row.name,
        render: (row) => (
          <Link to={`/geography/states/${row._id}`}>{row.name}</Link>
        ),
      },
      {
        key: 'code',
        header: t('geoColCode'),
        width: '8%',
        render: (row) => row.code || '—',
      },
      {
        key: 'providers',
        header: t('geoColProviders'),
        width: '12%',
        render: (row) => String(row.providerCount ?? 0),
      },
      {
        key: 'jobs',
        header: t('geoColJobsCpc'),
        width: '22%',
        render: (row) => formatJobs(row.jobStats),
      },
      {
        key: 'rating',
        header: t('geoColAvgRating'),
        width: '12%',
        render: (row) =>
          row.avgRating ? row.avgRating.toFixed(1) : t('geoNoRating'),
      },
      {
        key: 'reviews',
        header: t('geoColReviews'),
        width: '12%',
        render: (row) => String(row.totalReviews ?? 0),
      },
      {
        key: 'open',
        header: '',
        width: '12%',
        render: (row) => (
          <Link className="hs-btn hs-btn--ghost hs-btn--md" to={`/geography/states/${row._id}`}>
            {t('geoViewDistricts')}
          </Link>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="geography-states">
      <header className="page-header">
        <h1>{t('geoStatesTitle')}</h1>
        <p>{t('geoStatesLead')}</p>
      </header>
      <div className="filter-row">
        <Button variant="ghost" onClick={() => void load({force: true})}
          disabled={loading}>
          {t('geoRefresh')}
        </Button>
      </div>
      <div className="panel">
        {error ? <p className="error-text">{error}</p> : null}
        <VirtualTable
          columns={columns}
          data={rows}
          rowKey={(row) => row._id}
          height={480}
          pageSize={50}
          emptyMessage={t('empty')}
          loading={loading}
          loadingMessage={t('loading')}
        />
      </div>
    </div>
  );
}
