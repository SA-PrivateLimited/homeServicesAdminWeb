import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Widget,
  Loader,
} from 'sapvt-ltd-web-packages';
import {
  getOverviewStats,
  type OverviewGeoRow,
  type OverviewStats,
  type OverviewTrendPoint,
} from '../services/api/overviewApi';
import '../styles/pages.css';

type FocusKey = 'providers' | 'pending' | 'customers' | 'jobs';
type TrendMode = 'cumulative' | 'new';
type TrendDays = 7 | 30 | 90;

type StatusCount = {key: string; label: string; count: number; tone: string};

type PieSlice = {
  key: string;
  label: string;
  count: number;
  color: string;
};

type BarSeries = {
  key: string;
  label: string;
  color: string;
};

type MultiBarRow = {
  key: string;
  label: string;
  values: Record<string, number>;
};

const CHART_COLORS = {
  providers: 'var(--primary-color)',
  customers: 'var(--color-success, #2f9e44)',
  jobs: 'var(--color-warning, #f59f00)',
  pending: 'var(--color-warning, #f59f00)',
  approved: 'var(--color-success, #2f9e44)',
  rejected: 'var(--color-error, #e03131)',
  accepted: '#4c6ef5',
  inProgress: '#15aabf',
  completed: 'var(--color-success, #2f9e44)',
  cancelled: 'var(--color-error, #e03131)',
  unassigned: '#868e96',
  serviceJobs: '#4c6ef5',
  serviceProviders: 'var(--primary-color)',
  reach: '#0f766e',
};

function StatusBars({items}: {items: StatusCount[]}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div
      className="overview-status-vchart"
      role="img"
      aria-label="Status breakdown">
      {items.map((item) => {
        const pct = Math.max(0, Math.min(100, (item.count / max) * 100));
        return (
          <div key={item.key} className="overview-status-col">
            <span className="overview-status-value">{item.count}</span>
            <div className="overview-status-bar-track">
              <div
                className={`overview-status-bar overview-bar-fill--${item.tone}`}
                style={{height: `${pct}%`}}
              />
            </div>
            <span className="overview-status-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function OverviewPieChart({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: PieSlice[];
  centerLabel: string;
  centerValue: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 78;

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let angle = 0;
    return slices
      .filter((s) => s.count > 0)
      .map((slice) => {
        const sweep = (slice.count / total) * 360;
        if (sweep >= 359.99) {
          return {
            key: slice.key,
            color: slice.color,
            full: true as const,
          };
        }
        const start = angle;
        const end = angle + sweep;
        angle = end;
        return {
          key: slice.key,
          color: slice.color,
          full: false as const,
          d: describeArc(cx, cy, r, start, end),
        };
      });
  }, [slices, total, cx, cy, r]);

  return (
    <div className="overview-pie">
      <div className="overview-pie-chart" role="img" aria-label={centerLabel}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {total <= 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="var(--color-border)"
              opacity={0.35}
            />
          ) : (
            arcs.map((arc) =>
              arc.full ? (
                <circle key={arc.key} cx={cx} cy={cy} r={r} fill={arc.color} />
              ) : (
                <path key={arc.key} d={arc.d} fill={arc.color} />
              ),
            )
          )}
          <circle
            cx={cx}
            cy={cy}
            r={48}
            fill="var(--color-card)"
            className="overview-pie-hole"
          />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="overview-pie-total">
            {centerValue}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="overview-pie-caption">
            {centerLabel}
          </text>
        </svg>
      </div>
      <ul className="overview-pie-legend">
        {slices.map((slice) => {
          const pct =
            total > 0 ? Math.round((slice.count / total) * 1000) / 10 : 0;
          return (
            <li key={slice.key}>
              <span
                className="overview-pie-swatch"
                style={{background: slice.color}}
                aria-hidden
              />
              <span className="overview-pie-legend-label">{slice.label}</span>
              <strong>{slice.count}</strong>
              <span className="muted compact">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type TrendSeriesKey =
  | 'reach'
  | 'providers'
  | 'customers'
  | 'jobs';

function formatTrendLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[Number(parts[1]) - 1] || parts[1];
  return `${Number(parts[2])} ${month}`;
}

function TrendLineChart({
  points,
  mode,
  emptyLabel,
  seriesLabels,
}: {
  points: OverviewTrendPoint[];
  mode: TrendMode;
  emptyLabel: string;
  seriesLabels: Record<TrendSeriesKey, string>;
}) {
  const series = useMemo(
    () =>
      [
        {
          key: 'reach' as const,
          color: CHART_COLORS.reach,
          get: (p: OverviewTrendPoint) =>
            mode === 'cumulative' ? p.reachCumulative : p.reach,
        },
        {
          key: 'providers' as const,
          color: CHART_COLORS.providers,
          get: (p: OverviewTrendPoint) =>
            mode === 'cumulative' ? p.providersCumulative : p.providers,
        },
        {
          key: 'customers' as const,
          color: CHART_COLORS.customers,
          get: (p: OverviewTrendPoint) =>
            mode === 'cumulative' ? p.customersCumulative : p.customers,
        },
        {
          key: 'jobs' as const,
          color: CHART_COLORS.jobs,
          get: (p: OverviewTrendPoint) =>
            mode === 'cumulative' ? p.jobsCumulative : p.jobs,
        },
      ] as const,
    [mode],
  );

  const values = points.flatMap((p) => series.map((s) => s.get(p)));
  const max = niceMax(Math.max(1, ...values));
  const width = 720;
  const height = 220;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const n = Math.max(points.length - 1, 1);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(max * p));

  const xAt = (i: number) => padL + (i / n) * plotW;
  const yAt = (v: number) => padT + plotH - (v / max) * plotH;

  const paths = series.map((s) => {
    const d = points
      .map((p, i) => {
        const x = xAt(i);
        const y = yAt(s.get(p));
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
    return {...s, d};
  });

  const labelIndexes = useMemo(() => {
    if (points.length <= 1) return [0];
    const count = Math.min(6, points.length);
    const idxs = new Set<number>();
    for (let i = 0; i < count; i += 1) {
      idxs.add(Math.round((i / (count - 1)) * (points.length - 1)));
    }
    return [...idxs].sort((a, b) => a - b);
  }, [points.length]);

  const latest = points[points.length - 1];

  if (!points.length) {
    return <p className="muted overview-chart-empty">{emptyLabel}</p>;
  }

  return (
    <div className="overview-trend">
      <div className="overview-trend-legend">
        {series.map((s) => (
          <span key={s.key} className="overview-trend-legend-item">
            <span
              className="overview-pie-swatch"
              style={{background: s.color}}
              aria-hidden
            />
            <span>{seriesLabels[s.key]}</span>
            {latest ? (
              <strong>{s.get(latest)}</strong>
            ) : null}
          </span>
        ))}
      </div>

      <div className="overview-trend-svg-wrap">
        <svg
          className="overview-trend-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Growth trend">
          {ticks.map((tick) => {
            const y = yAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  className="overview-trend-grid"
                />
                <text
                  x={padL - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="overview-trend-ytick">
                  {tick}
                </text>
              </g>
            );
          })}

          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {paths.map((p) => {
            const last = points[points.length - 1];
            if (!last) return null;
            return (
              <circle
                key={`${p.key}-dot`}
                cx={xAt(points.length - 1)}
                cy={yAt(p.get(last))}
                r={3.5}
                fill={p.color}
              />
            );
          })}

          {labelIndexes.map((i) => (
            <text
              key={points[i]?.date || i}
              x={xAt(i)}
              y={height - 10}
              textAnchor="middle"
              className="overview-trend-xtick">
              {formatTrendLabel(points[i]?.date || '')}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function niceMax(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * exp;
}

function MultiBarChart({
  rows,
  series,
  emptyLabel,
}: {
  rows: MultiBarRow[];
  series: BarSeries[];
  emptyLabel: string;
}) {
  const rawMax = Math.max(
    1,
    ...rows.flatMap((row) => series.map((s) => row.values[s.key] || 0)),
  );
  const max = niceMax(rawMax);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(max * p));

  if (!rows.length) {
    return <p className="muted overview-chart-empty">{emptyLabel}</p>;
  }

  return (
    <div
      className="overview-vchart"
      role="img"
      aria-label="Vertical comparison chart">
      <div className="overview-vchart-legend">
        {series.map((s) => (
          <span key={s.key} className="overview-vchart-legend-item">
            <span
              className="overview-pie-swatch"
              style={{background: s.color}}
              aria-hidden
            />
            {s.label}
          </span>
        ))}
      </div>

      <div className="overview-vchart-body">
        <div className="overview-vchart-yaxis" aria-hidden>
          {[...ticks].reverse().map((tick) => (
            <span key={tick} className="overview-vchart-ytick">
              {tick}
            </span>
          ))}
        </div>

        <div className="overview-vchart-plot">
          <div className="overview-vchart-grid" aria-hidden>
            {ticks.map((tick) => (
              <div
                key={tick}
                className="overview-vchart-gridline"
                style={{bottom: `${(tick / max) * 100}%`}}
              />
            ))}
          </div>

          <div className="overview-vchart-groups">
            {rows.map((row) => (
              <div key={row.key} className="overview-vchart-group">
                <div className="overview-vchart-bars">
                  {series.map((s) => {
                    const value = row.values[s.key] || 0;
                    const pct = Math.max(0, Math.min(100, (value / max) * 100));
                    return (
                      <div
                        key={s.key}
                        className="overview-vchart-col"
                        title={`${s.label}: ${value}`}>
                        <span className="overview-vchart-value">
                          {value > 0 ? value : ''}
                        </span>
                        <div className="overview-vchart-bar-track">
                          <div
                            className="overview-vchart-bar"
                            style={{
                              height: `${pct}%`,
                              background: s.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="overview-vchart-xlabel" title={row.label}>
                  {row.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function geoToMultiRows(rows: OverviewGeoRow[], limit = 12): MultiBarRow[] {
  return rows
    .filter((r) => r.providers + r.customers + r.jobs > 0)
    .slice(0, limit)
    .map((r) => ({
      key: r.stateId || r.districtId || r.name,
      label: r.name,
      values: {
        providers: r.providers,
        customers: r.customers,
        jobs: r.jobs,
      },
    }));
}

export function OverviewPage() {
  const {t} = useTranslation();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [selectedStateId, setSelectedStateId] = useState('');
  const [trendDays, setTrendDays] = useState<TrendDays>(30);
  const [trendMode, setTrendMode] = useState<TrendMode>('cumulative');
  const [focus, setFocus] = useState<FocusKey>('providers');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [districtLoading, setDistrictLoading] = useState(false);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasLoadedOnce.current) setLoading(true);
      else setDistrictLoading(true);
      try {
        const data = await getOverviewStats({
          ...(selectedStateId ? {stateId: selectedStateId} : {}),
          days: trendDays,
        });
        if (cancelled) return;
        setStats(data);
        setError(null);
        hasLoadedOnce.current = true;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('errorGeneric'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setDistrictLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStateId, trendDays, t]);

  const providerTotal = stats?.providers.total ?? 0;
  const pendingCount = stats?.providers.pending ?? 0;
  const approvedCount = stats?.providers.approved ?? 0;
  const rejectedCount = stats?.providers.rejected ?? 0;
  const customers = stats?.customers.total ?? 0;
  const jobTotal = stats?.jobs.total ?? 0;
  const jobStatus = stats?.jobs.byStatus;

  const providerBreakdown = useMemo(
    () => [
      {
        key: 'pending',
        label: t('filter_pending'),
        count: pendingCount,
        tone: 'pending',
      },
      {
        key: 'approved',
        label: t('filter_approved'),
        count: approvedCount,
        tone: 'approved',
      },
      {
        key: 'rejected',
        label: t('filter_rejected'),
        count: rejectedCount,
        tone: 'rejected',
      },
    ],
    [pendingCount, approvedCount, rejectedCount, t],
  );

  const jobBreakdown = useMemo(() => {
    const order: Array<{key: keyof NonNullable<typeof jobStatus>; tone: string; i18n: string}> = [
      {key: 'pending', tone: 'pending', i18n: 'jobStatus_pending'},
      {key: 'unassigned', tone: 'pending', i18n: 'jobStatus_unassigned'},
      {key: 'accepted', tone: 'pending', i18n: 'jobStatus_accepted'},
      {key: 'inProgress', tone: 'pending', i18n: 'jobStatus_in_progress'},
      {key: 'completed', tone: 'approved', i18n: 'jobStatus_completed'},
      {key: 'cancelled', tone: 'rejected', i18n: 'jobStatus_cancelled'},
    ];
    return order.map((o) => ({
      key: o.key,
      label: t(o.i18n as 'jobStatus_pending'),
      count: jobStatus?.[o.key] || 0,
      tone: o.tone,
    }));
  }, [jobStatus, t]);

  const userMixSlices = useMemo<PieSlice[]>(
    () => [
      {
        key: 'providers',
        label: t('statProviders'),
        count: providerTotal,
        color: CHART_COLORS.providers,
      },
      {
        key: 'customers',
        label: t('statCustomers'),
        count: customers,
        color: CHART_COLORS.customers,
      },
    ],
    [providerTotal, customers, t],
  );

  const providerPieSlices = useMemo<PieSlice[]>(
    () => [
      {
        key: 'pending',
        label: t('filter_pending'),
        count: pendingCount,
        color: CHART_COLORS.pending,
      },
      {
        key: 'approved',
        label: t('filter_approved'),
        count: approvedCount,
        color: CHART_COLORS.approved,
      },
      {
        key: 'rejected',
        label: t('filter_rejected'),
        count: rejectedCount,
        color: CHART_COLORS.rejected,
      },
    ],
    [pendingCount, approvedCount, rejectedCount, t],
  );

  const jobPieSlices = useMemo<PieSlice[]>(
    () => [
      {
        key: 'pending',
        label: t('jobStatus_pending'),
        count: jobStatus?.pending || 0,
        color: CHART_COLORS.pending,
      },
      {
        key: 'unassigned',
        label: t('jobStatus_unassigned'),
        count: jobStatus?.unassigned || 0,
        color: CHART_COLORS.unassigned,
      },
      {
        key: 'accepted',
        label: t('jobStatus_accepted'),
        count: jobStatus?.accepted || 0,
        color: CHART_COLORS.accepted,
      },
      {
        key: 'inProgress',
        label: t('jobStatus_in_progress'),
        count: jobStatus?.inProgress || 0,
        color: CHART_COLORS.inProgress,
      },
      {
        key: 'completed',
        label: t('jobStatus_completed'),
        count: jobStatus?.completed || 0,
        color: CHART_COLORS.completed,
      },
      {
        key: 'cancelled',
        label: t('jobStatus_cancelled'),
        count: jobStatus?.cancelled || 0,
        color: CHART_COLORS.cancelled,
      },
    ],
    [jobStatus, t],
  );

  const geoSeries = useMemo<BarSeries[]>(
    () => [
      {key: 'providers', label: t('statProviders'), color: CHART_COLORS.providers},
      {key: 'customers', label: t('statCustomers'), color: CHART_COLORS.customers},
      {key: 'jobs', label: t('statJobs'), color: CHART_COLORS.jobs},
    ],
    [t],
  );

  const serviceSeries = useMemo<BarSeries[]>(
    () => [
      {
        key: 'providers',
        label: t('statProviders'),
        color: CHART_COLORS.serviceProviders,
      },
      {
        key: 'jobs',
        label: t('statJobs'),
        color: CHART_COLORS.serviceJobs,
      },
    ],
    [t],
  );

  const geoRows = useMemo(() => {
    if (selectedStateId && stats?.byDistrict?.length) {
      return geoToMultiRows(stats.byDistrict);
    }
    return geoToMultiRows(stats?.byState || []);
  }, [selectedStateId, stats]);

  const serviceRows = useMemo<MultiBarRow[]>(
    () =>
      (stats?.byService || [])
        .filter((s) => s.providers + s.jobs > 0)
        .slice(0, 12)
        .map((s) => ({
          key: s.serviceType,
          label: s.serviceType,
          values: {providers: s.providers, jobs: s.jobs},
        })),
    [stats],
  );

  const selectedStateName =
    stats?.byState.find((s) => s.stateId === selectedStateId)?.name || '';

  const trendSeriesLabels = useMemo(
    () => ({
      reach: t('overviewTrendReach'),
      providers: t('statProviders'),
      customers: t('statCustomers'),
      jobs: t('statJobs'),
    }),
    [t],
  );

  const cards: Array<{key: FocusKey; label: string; value: number}> = [
    {key: 'providers', label: t('statProviders'), value: providerTotal},
    {key: 'pending', label: t('statPending'), value: pendingCount},
    {key: 'customers', label: t('statCustomers'), value: customers},
    {key: 'jobs', label: t('statJobs'), value: jobTotal},
  ];

  const detailTitle =
    focus === 'providers'
      ? t('overviewProvidersDetail')
      : focus === 'pending'
        ? t('overviewPendingDetail')
        : focus === 'customers'
          ? t('overviewCustomersDetail')
          : t('overviewJobsDetail');

  const usersTotal = providerTotal + customers;

  return (
    <div className="admin-page scale-baseline-80" data-testid="overview-root">
      <header className="page-header">
        <h1>{t('overviewTitle')}</h1>
        <p>{t('overviewLead')}</p>
      </header>

      {loading ? <Loader label={t('loading')} /> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error && stats ? (
        <>
          <div className="stat-grid">
            {cards.map((card) => (
              <button
                key={card.key}
                type="button"
                className={`stat-card interactive${
                  focus === card.key ? ' stat-card--active' : ''
                }`}
                aria-pressed={focus === card.key}
                onClick={() => setFocus(card.key)}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </button>
            ))}
          </div>

          <div className="overview-toolbar">
            <label className="overview-toolbar-label" htmlFor="overview-state">
              {t('overviewRegionFilter')}
            </label>
            <select
              id="overview-state"
              className="overview-state-select"
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}>
              <option value="">{t('overviewAllStates')}</option>
              {(stats.byState || []).map((s) => (
                <option key={s.stateId} value={s.stateId || ''}>
                  {s.name}
                  {s.jobs || s.providers || s.customers
                    ? ` (${s.jobs + s.providers + s.customers})`
                    : ''}
                </option>
              ))}
            </select>
            {districtLoading ? (
              <span className="muted compact">{t('loading')}</span>
            ) : null}
          </div>

          <div className="overview-panels overview-panels--charts">
            <Widget
              title={t('overviewTrendTitle')}
              subtitle={t('overviewTrendLead')}
              className="overview-detail overview-detail--trend"
              testId="overview-trend"
              actions={
                <div className="overview-trend-controls">
                  <div
                    className="overview-segmented"
                    role="group"
                    aria-label={t('overviewTrendMode')}>
                    <button
                      type="button"
                      className={
                        trendMode === 'cumulative'
                          ? 'overview-segmented__btn is-active'
                          : 'overview-segmented__btn'
                      }
                      onClick={() => setTrendMode('cumulative')}>
                      {t('overviewTrendCumulative')}
                    </button>
                    <button
                      type="button"
                      className={
                        trendMode === 'new'
                          ? 'overview-segmented__btn is-active'
                          : 'overview-segmented__btn'
                      }
                      onClick={() => setTrendMode('new')}>
                      {t('overviewTrendNew')}
                    </button>
                  </div>
                  <div
                    className="overview-segmented"
                    role="group"
                    aria-label={t('overviewTrendRange')}>
                    {([7, 30, 90] as TrendDays[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={
                          trendDays === d
                            ? 'overview-segmented__btn is-active'
                            : 'overview-segmented__btn'
                        }
                        onClick={() => setTrendDays(d)}>
                        {t('overviewTrendDays', {count: d})}
                      </button>
                    ))}
                  </div>
                </div>
              }>
              <TrendLineChart
                points={stats.trend?.points || []}
                mode={trendMode}
                emptyLabel={t('overviewTrendEmpty')}
                seriesLabels={trendSeriesLabels}
              />
            </Widget>

            <Widget
              title={t('overviewUsersMixTitle')}
              subtitle={t('overviewUsersMixLead')}
              className="overview-detail"
              testId="overview-users-pie">
              <OverviewPieChart
                slices={userMixSlices}
                centerLabel={t('overviewUsersTotal')}
                centerValue={usersTotal}
              />
            </Widget>

            <Widget
              title={t('overviewProvidersPieTitle')}
              subtitle={t('overviewProvidersPieLead')}
              className="overview-detail"
              testId="overview-providers-pie">
              <OverviewPieChart
                slices={providerPieSlices}
                centerLabel={t('statProviders')}
                centerValue={providerTotal}
              />
            </Widget>

            <Widget
              title={t('overviewJobsPieTitle')}
              subtitle={t('overviewJobsPieLead')}
              className="overview-detail"
              testId="overview-jobs-pie">
              <OverviewPieChart
                slices={jobPieSlices}
                centerLabel={t('statJobs')}
                centerValue={jobTotal}
              />
            </Widget>

            <Widget
              title={
                selectedStateId
                  ? t('overviewDistrictBarTitle', {state: selectedStateName})
                  : t('overviewStateBarTitle')
              }
              subtitle={
                selectedStateId
                  ? t('overviewDistrictBarLead')
                  : t('overviewStateBarLead')
              }
              className="overview-detail overview-detail--chart"
              testId="overview-geo-bars">
              <MultiBarChart
                rows={geoRows}
                series={geoSeries}
                emptyLabel={t('overviewChartEmpty')}
              />
            </Widget>

            <Widget
              title={t('overviewServiceBarTitle')}
              subtitle={t('overviewServiceBarLead')}
              className="overview-detail overview-detail--chart"
              testId="overview-service-bars">
              <MultiBarChart
                rows={serviceRows}
                series={serviceSeries}
                emptyLabel={t('overviewChartEmpty')}
              />
            </Widget>

            <Widget
              title={detailTitle}
              subtitle={t('overviewDetailHint')}
              className="overview-detail"
              testId="overview-detail">
              {focus === 'providers' || focus === 'pending' ? (
                <>
                  <p className="overview-detail-lead">
                    {focus === 'pending'
                      ? t('overviewPendingLead', {count: pendingCount})
                      : t('overviewProvidersLead', {count: providerTotal})}
                  </p>
                  <StatusBars
                    items={
                      focus === 'pending'
                        ? providerBreakdown.filter((i) => i.key === 'pending')
                        : providerBreakdown
                    }
                  />
                </>
              ) : null}

              {focus === 'customers' ? (
                <p className="overview-detail-lead">
                  {t('overviewCustomersLead', {count: customers})}
                </p>
              ) : null}

              {focus === 'jobs' ? (
                <>
                  <p className="overview-detail-lead">
                    {t('overviewJobsLead', {count: jobTotal})}
                  </p>
                  <StatusBars items={jobBreakdown} />
                </>
              ) : null}
            </Widget>
          </div>
        </>
      ) : null}
    </div>
  );
}
