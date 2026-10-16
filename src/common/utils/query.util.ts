import { Transform } from 'class-transformer';

/** Accepts `a,b`, repeated `?x=a&x=b`, or an array; yields a clean string[]. */
export const toStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = Array.isArray(value) ? value : String(value).split(',');
  const clean = items.map((item) => String(item).trim()).filter(Boolean);
  return clean.length ? clean : undefined;
};

export const ToStringArray = () => Transform(({ value }) => toStringArray(value));

export const ToBoolean = () =>
  Transform(({ value }) =>
    value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined,
  );

export const includesText = (haystack: unknown, needle: string): boolean =>
  String(haystack ?? '').toLowerCase().includes(needle.toLowerCase());

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

/** Parses `field:dir`, restricted to a whitelist so callers cannot sort on arbitrary keys. */
export const parseSort = (
  sort: string | undefined,
  allowed: string[],
  fallback: SortSpec,
): SortSpec => {
  if (!sort) return fallback;
  const [field, dir] = sort.split(':');
  if (!field || !allowed.includes(field)) return fallback;
  return { field, direction: dir === 'asc' ? 'asc' : 'desc' };
};

export const compareBy =
  <T>(spec: SortSpec, pick: (row: T, field: string) => unknown) =>
  (a: T, b: T): number => {
    const left = pick(a, spec.field) as string | number | null | undefined;
    const right = pick(b, spec.field) as string | number | null | undefined;
    if (left === right) return 0;
    if (left === undefined || left === null) return 1;
    if (right === undefined || right === null) return -1;
    const result = left < right ? -1 : 1;
    return spec.direction === 'asc' ? result : -result;
  };
