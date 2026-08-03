import {apiGet, apiPost} from './apiClient';
import type {Provider} from './providersApi';

export interface GeographyJobStats {
  totalJobs: number;
  pending: number;
  accepted: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface GeographyStateRow {
  _id: string;
  name: string;
  code?: string;
  providerCount: number;
  avgRating: number;
  totalReviews: number;
  jobStats: GeographyJobStats;
}

export interface GeographyDistrictRow {
  _id: string;
  name: string;
  stateId: string;
  stateName: string;
  providerCount: number;
  avgRating: number;
  totalReviews: number;
  jobStats: GeographyJobStats;
}

export interface GeographyProviderRow {
  _id: string;
  name: string;
  phone?: string;
  serviceType?: string;
  approvalStatus?: string;
  rating?: number;
  totalReviews?: number;
  location?: Provider['location'];
  jobStats: GeographyJobStats;
}

export interface GeographyMetaState {
  _id: string;
  name: string;
  code?: string;
}

export interface GeographyMetaDistrict {
  _id: string;
  name: string;
  stateId: string;
  stateName: string;
  pincode?: string;
}

export interface GeographyMeta {
  states: GeographyMetaState[];
  districts: GeographyMetaDistrict[];
}

const META_STORAGE_KEY = 'hs_admin_geography_meta_v1';
const META_TTL_MS = 24 * 60 * 60 * 1000;
const LIST_TTL_MS = 60 * 1000;

type CachedMeta = GeographyMeta & {cachedAt: number; version: number};

type ListCacheEntry<T> = {data: T; cachedAt: number};

let metaMemory: CachedMeta | null = null;
let metaInflight: Promise<GeographyMeta> | null = null;

const listCache = new Map<string, ListCacheEntry<unknown>>();

function listKeyStates(): string {
  return 'states';
}

function listKeyDistricts(stateId: string): string {
  return `states/${stateId}/districts`;
}

function listKeyProviders(districtId: string): string {
  return `districts/${districtId}/providers`;
}

function normalizeMeta(data: GeographyMeta | null | undefined): GeographyMeta {
  return {
    states: data?.states || [],
    districts: data?.districts || [],
  };
}

function isFresh(cachedAt: number, ttl: number): boolean {
  return Date.now() - cachedAt < ttl;
}

function readMetaSession(): CachedMeta | null {
  try {
    const raw = sessionStorage.getItem(META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMeta;
    if (!parsed?.states || !parsed?.districts) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMetaSession(meta: GeographyMeta): CachedMeta {
  const payload: CachedMeta = {
    ...normalizeMeta(meta),
    cachedAt: Date.now(),
    version: 1,
  };
  metaMemory = payload;
  try {
    sessionStorage.setItem(META_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
  return payload;
}

function getListCache<T>(key: string): T | null {
  const entry = listCache.get(key) as ListCacheEntry<T> | undefined;
  if (!entry) return null;
  if (!isFresh(entry.cachedAt, LIST_TTL_MS)) {
    listCache.delete(key);
    return null;
  }
  return entry.data;
}

function setListCache<T>(key: string, data: T): void {
  listCache.set(key, {data, cachedAt: Date.now()});
}

/** Invalidate list caches after create/assign (district + parent state + states). */
export function invalidateGeographyListCache(opts: {
  districtId?: string;
  stateId?: string;
  previousDistrictId?: string;
  previousStateId?: string;
}): void {
  listCache.delete(listKeyStates());
  if (opts.stateId) {
    listCache.delete(listKeyDistricts(opts.stateId));
  }
  if (opts.previousStateId && opts.previousStateId !== opts.stateId) {
    listCache.delete(listKeyDistricts(opts.previousStateId));
  }
  if (opts.districtId) {
    listCache.delete(listKeyProviders(opts.districtId));
  }
  if (
    opts.previousDistrictId &&
    opts.previousDistrictId !== opts.districtId
  ) {
    listCache.delete(listKeyProviders(opts.previousDistrictId));
  }
}

/** Sync peek of warm list cache (null if missing/expired). */
export function peekGeographyStates(): GeographyStateRow[] | null {
  return getListCache<GeographyStateRow[]>(listKeyStates());
}

export function peekGeographyDistricts(
  stateId: string,
): {districts: GeographyDistrictRow[]; state: GeographyMetaState} | null {
  return getListCache(listKeyDistricts(stateId));
}

export function peekGeographyProviders(districtId: string): {
  providers: GeographyProviderRow[];
  district: {
    _id: string;
    name: string;
    stateId: string;
    stateName: string;
    pincode?: string;
  };
} | null {
  return getListCache(listKeyProviders(districtId));
}

/** Force-clear all short-TTL list caches (Refresh control). */
export function clearGeographyListCache(): void {
  listCache.clear();
}

export async function getGeographyMeta(options?: {
  force?: boolean;
}): Promise<GeographyMeta> {
  const force = options?.force === true;

  if (!force && metaMemory) {
    const snapshot = normalizeMeta(metaMemory);
    if (!isFresh(metaMemory.cachedAt, META_TTL_MS)) {
      void softRefreshMeta(snapshot);
    }
    return snapshot;
  }

  if (!force) {
    const stored = readMetaSession();
    if (stored) {
      metaMemory = stored;
      const snapshot = normalizeMeta(stored);
      if (!isFresh(stored.cachedAt, META_TTL_MS)) {
        void softRefreshMeta(snapshot);
      }
      return snapshot;
    }
  }

  if (metaInflight && !force) {
    return metaInflight;
  }

  metaInflight = (async () => {
    try {
      const data = await apiGet<GeographyMeta>('/api/admin/geography/meta');
      const meta = normalizeMeta(data);
      writeMetaSession(meta);
      return meta;
    } catch (err) {
      if (metaMemory) return normalizeMeta(metaMemory);
      const stored = readMetaSession();
      if (stored) {
        metaMemory = stored;
        return normalizeMeta(stored);
      }
      throw err;
    } finally {
      metaInflight = null;
    }
  })();

  return metaInflight;
}

async function softRefreshMeta(_previous: GeographyMeta): Promise<void> {
  try {
    const data = await apiGet<GeographyMeta>('/api/admin/geography/meta');
    writeMetaSession(normalizeMeta(data));
  } catch {
    // keep serving cached data
  }
}

export async function getGeographyStates(options?: {
  force?: boolean;
}): Promise<GeographyStateRow[]> {
  const key = listKeyStates();
  if (!options?.force) {
    const hit = getListCache<GeographyStateRow[]>(key);
    if (hit) return hit;
  }
  const data = await apiGet<GeographyStateRow[]>('/api/admin/geography/states');
  setListCache(key, data);
  return data;
}

export async function getGeographyDistricts(
  stateId: string,
  options?: {force?: boolean},
): Promise<{districts: GeographyDistrictRow[]; state: GeographyMetaState}> {
  const key = listKeyDistricts(stateId);
  if (!options?.force) {
    const hit = getListCache<{
      districts: GeographyDistrictRow[];
      state: GeographyMetaState;
    }>(key);
    if (hit) return hit;
  }
  const data = await apiGet<{
    districts: GeographyDistrictRow[];
    state: GeographyMetaState;
  }>(`/api/admin/geography/states/${encodeURIComponent(stateId)}/districts`);
  setListCache(key, data);
  return data;
}

export async function getGeographyProviders(
  districtId: string,
  options?: {force?: boolean},
): Promise<{
  providers: GeographyProviderRow[];
  district: {
    _id: string;
    name: string;
    stateId: string;
    stateName: string;
    pincode?: string;
  };
}> {
  const key = listKeyProviders(districtId);
  if (!options?.force) {
    const hit = getListCache<{
      providers: GeographyProviderRow[];
      district: {
        _id: string;
        name: string;
        stateId: string;
        stateName: string;
        pincode?: string;
      };
    }>(key);
    if (hit) return hit;
  }
  const data = await apiGet<{
    providers: GeographyProviderRow[];
    district: {
      _id: string;
      name: string;
      stateId: string;
      stateName: string;
      pincode?: string;
    };
  }>(
    `/api/admin/geography/districts/${encodeURIComponent(districtId)}/providers`,
  );
  setListCache(key, data);
  return data;
}

export async function createProviderInDistrict(
  districtId: string,
  body: {
    name: string;
    phone: string;
    serviceType?: string;
    address?: string;
    pincode?: string;
    experience?: number;
    rating?: number;
    phoneVerified?: boolean;
  },
  options?: {stateId?: string},
): Promise<Provider> {
  const provider = await apiPost<Provider>(
    `/api/admin/geography/districts/${encodeURIComponent(districtId)}/providers`,
    body,
  );
  invalidateGeographyListCache({
    districtId,
    stateId: options?.stateId || provider.location?.stateId,
  });
  return provider;
}

export async function assignProviderToDistrict(
  districtId: string,
  providerId: string,
  options?: {
    stateId?: string;
    previousDistrictId?: string;
    previousStateId?: string;
  },
): Promise<Provider> {
  const provider = await apiPost<Provider>(
    `/api/admin/geography/districts/${encodeURIComponent(districtId)}/providers`,
    {providerId},
  );
  invalidateGeographyListCache({
    districtId,
    stateId: options?.stateId || provider.location?.stateId,
    previousDistrictId: options?.previousDistrictId,
    previousStateId: options?.previousStateId,
  });
  return provider;
}
