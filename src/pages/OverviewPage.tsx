import {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Widget} from 'sapvt-ltd-web-packages';
import {getProvidersPage} from '../services/api/providersApi';
import {getUsersPage} from '../services/api/usersApi';
import {getJobCardsPage} from '../services/api/jobCardsApi';
import '../styles/pages.css';

type FocusKey = 'providers' | 'pending' | 'customers' | 'jobs';

type StatusCount = {key: string; label: string; count: number; tone: string};

type PieSlice = {
  key: string;
  label: string;
  count: number;
  color: string;
};

function StatusBars({items}: {items: StatusCount[]}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div
      className="overview-bars"
      role="img"
      aria-label="Status breakdown">
      {items.map((item) => (
        <div key={item.key} className="overview-bar-row">
          <div className="overview-bar-meta">
            <span className={`badge badge-${item.tone}`}>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
          <div className="overview-bar-track">
            <div
              className={`overview-bar-fill overview-bar-fill--${item.tone}`}
              style={{width: `${(item.count / max) * 100}%`}}
            />
          </div>
        </div>
      ))}
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
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 88;

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
            r={54}
            fill="var(--color-card)"
            className="overview-pie-hole"
          />
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className="overview-pie-total">
            {centerValue}
          </text>
          <text
            x={cx}
            y={cy + 16}
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

export function OverviewPage() {
  const {t} = useTranslation();
  const [providerTotal, setProviderTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [customers, setCustomers] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const [jobStatusCounts, setJobStatusCounts] = useState<Record<string, number>>(
    {},
  );
  const [focus, setFocus] = useState<FocusKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const jobStatuses = [
          'pending',
          'accepted',
          'in-progress',
          'completed',
          'cancelled',
          'unassigned',
        ] as const;

        const [
          providerPage,
          pendingPage,
          approvedPage,
          rejectedPage,
          customerPage,
          jobPage,
          ...jobStatusPages
        ] = await Promise.all([
          getProvidersPage({limit: 1, offset: 0}),
          getProvidersPage({approvalStatus: 'pending', limit: 1, offset: 0}),
          getProvidersPage({approvalStatus: 'approved', limit: 1, offset: 0}),
          getProvidersPage({approvalStatus: 'rejected', limit: 1, offset: 0}),
          getUsersPage({role: 'customer', limit: 1, offset: 0}),
          getJobCardsPage({limit: 1, offset: 0}),
          ...jobStatuses.map((status) =>
            getJobCardsPage({status, limit: 1, offset: 0}),
          ),
        ]);

        if (cancelled) return;

        setProviderTotal(providerPage.total);
        setPendingCount(pendingPage.total);
        setApprovedCount(approvedPage.total);
        setRejectedCount(rejectedPage.total);
        setCustomers(customerPage.total);
        setJobTotal(jobPage.total);

        const counts: Record<string, number> = {};
        jobStatuses.forEach((status, i) => {
          counts[status] = jobStatusPages[i]?.total ?? 0;
        });
        setJobStatusCounts(counts);
        setFocus('providers');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('errorGeneric'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

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
    const order: Array<{key: string; tone: string}> = [
      {key: 'pending', tone: 'pending'},
      {key: 'unassigned', tone: 'pending'},
      {key: 'accepted', tone: 'pending'},
      {key: 'in-progress', tone: 'pending'},
      {key: 'completed', tone: 'approved'},
      {key: 'cancelled', tone: 'rejected'},
    ];
    return order.map((o) => ({
      key: o.key,
      label: t(`jobStatus_${o.key.replace('-', '_')}` as 'jobStatus_pending'),
      count: jobStatusCounts[o.key] || 0,
      tone: o.tone,
    }));
  }, [jobStatusCounts, t]);

  const userMixSlices = useMemo<PieSlice[]>(
    () => [
      {
        key: 'providers',
        label: t('statProviders'),
        count: providerTotal,
        color: 'var(--primary-color)',
      },
      {
        key: 'customers',
        label: t('statCustomers'),
        count: customers,
        color: 'var(--secondary-color, var(--color-success))',
      },
    ],
    [providerTotal, customers, t],
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
          : focus === 'jobs'
            ? t('overviewJobsDetail')
            : '';

  const usersTotal = providerTotal + customers;

  return (
    <div className="admin-page scale-baseline-80" data-testid="overview-root">
      <header className="page-header">
        <h1>{t('overviewTitle')}</h1>
        <p>{t('overviewLead')}</p>
      </header>

      {loading ? <p className="muted">{t('loading')}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error ? (
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
                onClick={() =>
                  setFocus((prev) => (prev === card.key ? prev : card.key))
                }>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </button>
            ))}
          </div>

          <div className="overview-panels">
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

            {focus ? (
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
                        : t('overviewProvidersLead', {
                            count: providerTotal,
                          })}
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
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
