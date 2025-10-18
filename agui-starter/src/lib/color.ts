import { getAccentContrastInfo } from "./theme";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string | null | undefined): value is string {
  if (!value) return false;
  return HEX_COLOR_PATTERN.test(value.trim());
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!isHexColor(value)) return null;
  const trimmed = value.trim();
  if (trimmed.length === 4) {
    const expanded = trimmed
      .slice(1)
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return `#${trimmed.slice(1).toLowerCase()}`;
}

type AccentPair = {
  accent: string;
  contrast: string;
};

export function resolveAccentPair(
  accentColor: string | null | undefined,
  fallbackAccent: string,
  fallbackContrast: string
): AccentPair {
  const accent = accentColor?.trim();
  if (!accent) {
    return { accent: fallbackAccent, contrast: fallbackContrast };
  }

  if (isHexColor(accent)) {
    const { recommendedText } = getAccentContrastInfo(accent);
    return { accent, contrast: recommendedText };
  }

  return { accent, contrast: fallbackContrast };
}


