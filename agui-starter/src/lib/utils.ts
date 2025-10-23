// Tiny classnames helper to combine conditional strings.
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function pluralize(label: string): string {
  const value = label.trim();
  if (value.length === 0) {
    return label;
  }

  const lower = value.toLowerCase();
  if (/s$|x$|z$|ch$|sh$/i.test(value)) {
    return `${value}es`;
  }

  if (/[^aeiou]y$/i.test(value)) {
    return `${value.slice(0, -1)}ies`;
  }

  if (lower.endsWith("s")) {
    return value;
  }

  return `${value}s`;
}
