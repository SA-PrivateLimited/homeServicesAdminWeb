import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  VirtualTable,
  type VirtualTableColumn,
  Button,
} from 'sapvt-ltd-web-packages';
import {
  clearGeographyListCache,
  getGeographyDistricts,
  peekGeographyDistricts,
  type GeographyDistrictRow,
  type GeographyJobStats,
  type GeographyMetaState,
} from '../services/api/geographyApi';
import {sortByUpdatedThenCreated} from '../utils/sort';
import '../styles/pages.css';

function formatJobs(stats?: GeographyJobStats): string {
  if (!stats) return '—';
  return `${stats.completed}/${stats.pending}/${stats.cancelled}`;
}

export function GeographyDistrictsPage() {
  const {stateId} = useParams();
  const {t} = useTranslation();
  const warm = stateId ? peekGeographyDistricts(stateId) : null;
  const [rows, setRows] = useState<GeographyDistrictRow[]>(
    () => warm?.districts || [],
  );
  const [state, setState] = useState<GeographyMetaState | null>(
    () => warm?.state || null,
  );
  const [loading, setLoading] = useState(() => !warm);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: {force?: boolean}) => {
    if (!stateId) return;
    const force = opts?.force === true;
    if (force) clearGeographyListCache();
    const cached = !force ? peekGeographyDistricts(stateId) : null;
    if (cached) {
      setRows(sortByUpdatedThenCreated(cached.districts));
      setState(cached.state);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await getGeographyDistricts(stateId, {force});
      setRows(sortByUpdatedThenCreated(result.districts));
      setState(result.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [stateId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<VirtualTableColumn<GeographyDistrictRow>[]>(
    () => [
      {
        key: 'name',
        header: t('geoColDistrict'),
        width: '24%',
        filterable: true,
        filterValue: (row) => row.name,
        render: (row) => (
          <Link to={`/geography/districts/${row._id}`}>{row.name}</Link>
        ),
      },
      {
        key: 'providers',
        header: t('geoColProviders'),
        width: '20%',
        render: (row) => (
          <span>
            {String(row.providerCount ?? 0)}
            {row.serviceBreakdown?.length ? (
              <span className="muted compact geo-service-breakdown">
                {row.serviceBreakdown
                  .slice(0, 4)
                  .map((item) => `${item.service} ${item.count}`)
                  .join(' · ')}
              </span>
            ) : null}
          </span>
        ),
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
        width: '18%',
        render: (row) => (
          <Link
            className="hs-btn hs-btn--ghost hs-btn--md"
            to={`/geography/districts/${row._id}`}>
            {t('geoViewProviders')}
          </Link>
        ),
      },
    ],
    [t],
  );

  return (
    <div
      className="admin-page scale-baseline-80"
      data-testid="geography-districts">
      <header className="page-header">
        <p className="muted compact">
          <Link to="/geography">{t('geoStatesTitle')}</Link>
          {state ? ` / ${state.name}` : ''}
        </p>
        <h1>{t('geoDistrictsTitle', {state: state?.name || '…'})}</h1>
        <p>{t('geoDistrictsLead')}</p>
      </header>
      <div className="filter-row">
        <Link className="hs-btn hs-btn--ghost hs-btn--md" to="/geography">
          {t('back')}
        </Link>
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
