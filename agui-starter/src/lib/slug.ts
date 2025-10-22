export type SlugifyOptions = {
  separator?: string;
  maxLength?: number;
  fallback?: string;
};

const DEFAULT_SEPARATOR = "-";
const DEFAULT_FALLBACK = "n-a";

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimSeparators(value: string, separator: string): string {
  const pattern = new RegExp(`^${escapeRegExp(separator)}+|${escapeRegExp(separator)}+$`, "g");
  return value.replace(pattern, "");
}

function collapseSeparators(value: string, separator: string): string {
  const pattern = new RegExp(`${escapeRegExp(separator)}{2,}`, "g");
  return value.replace(pattern, separator);
}

export function slugify(input: string, options: SlugifyOptions = {}): string {
  const separator = options.separator ?? DEFAULT_SEPARATOR;
  const fallback = options.fallback ?? DEFAULT_FALLBACK;
  const maxLength = options.maxLength ?? null;

  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const replaced = normalized.replace(/[^a-z0-9]+/g, separator);
  let slug = collapseSeparators(trimSeparators(replaced, separator), separator);

  if (!slug) {
    slug = fallback;
  }

  if (maxLength && slug.length > maxLength) {
    slug = trimSeparators(slug.slice(0, maxLength), separator) || fallback;
  }

  return slug;
}

type AvailabilityChecker = (slug: string) => boolean | Promise<boolean>;

export type UniqueSlugOptions = {
  isAvailable: AvailabilityChecker;
  separator?: string;
  maxLength?: number;
  maxAttempts?: number;
  startIndex?: number;
  fallback?: string;
};

function clampSlugLength(slug: string, separator: string, maxLength: number | undefined | null, fallback: string): string {
  if (!maxLength || maxLength <= 0) return slug;
  if (slug.length <= maxLength) return slug;

  const trimmed = trimSeparators(slug.slice(0, maxLength), separator);
  return trimmed || fallback.slice(0, maxLength);
}

function buildCandidate(
  base: string,
  attempt: number,
  separator: string,
  maxLength: number | undefined | null,
  fallback: string,
): string {
  if (attempt === 1) {
    return clampSlugLength(base, separator, maxLength, fallback);
  }

  const suffix = `${separator}${attempt}`;
  const allowedBaseLength = typeof maxLength === "number" && maxLength > 0 ? Math.max(1, maxLength - suffix.length) : undefined;
  let workingBase = base;

  if (allowedBaseLength !== undefined) {
    workingBase = trimSeparators(base.slice(0, allowedBaseLength), separator);
    if (!workingBase) {
      workingBase = base.slice(0, allowedBaseLength);
    }
  }

  const candidate = `${workingBase}${suffix}`;
  return clampSlugLength(candidate, separator, maxLength, fallback);
}

export async function uniqueSlug(
  value: string,
  {
    isAvailable,
    separator = DEFAULT_SEPARATOR,
    maxLength,
    maxAttempts = 50,
    startIndex = 1,
    fallback = DEFAULT_FALLBACK,
  }: UniqueSlugOptions,
): Promise<string> {
  if (startIndex < 1) {
    throw new Error("startIndex must be >= 1");
  }

  const base = slugify(value, { separator, fallback });
  let attempt = startIndex;

  while (attempt < startIndex + maxAttempts) {
    const candidate = buildCandidate(base, attempt, separator, maxLength, fallback);
    // eslint-disable-next-line no-await-in-loop
    const available = await isAvailable(candidate);
    if (available) {
      return candidate;
    }
    attempt += 1;
  }

  throw new Error(`Unable to generate unique slug for "${value}" after ${maxAttempts} attempts.`);
}
