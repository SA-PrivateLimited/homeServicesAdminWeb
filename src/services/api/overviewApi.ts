import {apiGet} from './apiClient';

export interface OverviewJobStatusCounts {
  pending: number;
  unassigned: number;
  accepted: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface OverviewGeoRow {
  stateId?: string;
  districtId?: string;
  name: string;
  providers: number;
  customers: number;
  jobs: number;
  jobStatus: OverviewJobStatusCounts;
}

export interface OverviewServiceRow {
  serviceType: string;
  providers: number;
  jobs: number;
}

export interface OverviewTrendPoint {
  date: string;
  providers: number;
  customers: number;
  jobs: number;
  reach: number;
  providersCumulative: number;
  customersCumulative: number;
  jobsCumulative: number;
  reachCumulative: number;
}

export interface OverviewTrend {
  days: number;
  startDate: string | null;
  endDate: string | null;
  points: OverviewTrendPoint[];
}

export interface OverviewStats {
  providers: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  customers: {total: number};
  jobs: {
    total: number;
    byStatus: OverviewJobStatusCounts;
  };
  byState: OverviewGeoRow[];
  byDistrict: OverviewGeoRow[];
  byService: OverviewServiceRow[];
  trend: OverviewTrend;
  selectedStateId: string | null;
}

export async function getOverviewStats(options?: {
  stateId?: string;
  days?: number;
}): Promise<OverviewStats> {
  const params = new URLSearchParams();
  if (options?.stateId) params.set('stateId', options.stateId);
  if (options?.days) params.set('days', String(options.days));
  const qs = params.toString();
  const path = qs ? `/api/admin/overview/stats?${qs}` : '/api/admin/overview/stats';
  return apiGet<OverviewStats>(path);
}
