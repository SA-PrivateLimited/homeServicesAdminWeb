/** Default Admin Web table order: newest activity first. */
export type TimestampedRow = {
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

function toTime(value?: string | Date | null): number {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Sort by updatedAt desc, then createdAt desc. */
export function compareUpdatedThenCreated(
  a: TimestampedRow,
  b: TimestampedRow,
): number {
  const updatedDiff = toTime(b.updatedAt) - toTime(a.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;
  return toTime(b.createdAt) - toTime(a.createdAt);
}

export function sortByUpdatedThenCreated<T extends TimestampedRow>(
  rows: T[],
): T[] {
  return rows.slice().sort(compareUpdatedThenCreated);
}
