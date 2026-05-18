import { PaletteNoteColor, NoteType } from '../types';

export const PALETTE_COLOR_KEYS: PaletteNoteColor[] = [
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'orange',
  'teal',
  'slate',
];

export const PALETTE_COLORS: Record<PaletteNoteColor, { bg: string; dark: string; text: string }> = {
  yellow: { bg: '#fef3c7', dark: '#fde68a', text: '#78350f' },
  green: { bg: '#dcfce7', dark: '#bbf7d0', text: '#14532d' },
  blue: { bg: '#dbeafe', dark: '#bfdbfe', text: '#1e3a8a' },
  purple: { bg: '#f3e8ff', dark: '#e9d5ff', text: '#581c87' },
  pink: { bg: '#fce7f3', dark: '#fbcfe8', text: '#831843' },
  orange: { bg: '#ffedd5', dark: '#fed7aa', text: '#7c2d12' },
  teal: { bg: '#ccfbf1', dark: '#99f6e4', text: '#134e4a' },
  slate: { bg: '#e2e8f0', dark: '#cbd5e1', text: '#0f172a' },
};

export const DEFAULT_TYPE_COLORS: Record<NoteType, string> = {
  note: 'yellow',
  title: 'blue',
};

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SAFE_RGB_MIN = 80;
const SAFE_RGB_MAX = 235;
const SAFE_SAT_MIN = 30;
const SAFE_SAT_MAX = 65;
const SAFE_LIGHT_MIN = 70;
const SAFE_LIGHT_MAX = 88;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeHex = (hex: string): string => {
  if (!HEX_COLOR_REGEX.test(hex)) return '';
  const lowered = hex.toLowerCase();
  if (lowered.length === 4) {
    const r = lowered[1];
    const g = lowered[2];
    const b = lowered[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return lowered;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const channel = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
};

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
};

const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh >= 0 && hh < 1) {
    r1 = c; g1 = x; b1 = 0;
  } else if (hh < 2) {
    r1 = x; g1 = c; b1 = 0;
  } else if (hh < 3) {
    r1 = 0; g1 = c; b1 = x;
  } else if (hh < 4) {
    r1 = 0; g1 = x; b1 = c;
  } else if (hh < 5) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }

  const m = ln - c / 2;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
};

const constrainHexTone = (hex: string): string => {
  const normalized = normalizeHex(hex);
  if (!normalized) return '';
  const { r, g, b } = hexToRgb(normalized);
  const { h, s, l } = rgbToHsl(r, g, b);
  const constrainedRgb = hslToRgb(
    h,
    clamp(s, SAFE_SAT_MIN, SAFE_SAT_MAX),
    clamp(l, SAFE_LIGHT_MIN, SAFE_LIGHT_MAX)
  );
  return rgbToHex(
    clamp(constrainedRgb.r, SAFE_RGB_MIN, SAFE_RGB_MAX),
    clamp(constrainedRgb.g, SAFE_RGB_MIN, SAFE_RGB_MAX),
    clamp(constrainedRgb.b, SAFE_RGB_MIN, SAFE_RGB_MAX)
  );
};

const shadeColor = (hex: string, factor: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
};

const getContrastText = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 146 ? '#1f2937' : '#f9fafb';
};

export const isPaletteColor = (color?: string | null): color is PaletteNoteColor => {
  return !!color && (PALETTE_COLOR_KEYS as string[]).includes(color);
};

export const isValidHexColor = (color?: string | null): boolean => {
  return !!color && HEX_COLOR_REGEX.test(color);
};

export const isAllowedNoteColor = (color?: string | null): boolean => {
  return isPaletteColor(color) || isValidHexColor(color);
};

export const sanitizeNoteColor = (color?: string | null, fallback: string = DEFAULT_TYPE_COLORS.note): string => {
  if (isPaletteColor(color)) return color;
  if (isValidHexColor(color)) return constrainHexTone(color);
  return fallback;
};

export const resolveNoteColors = (color?: string | null) => {
  const safe = sanitizeNoteColor(color);
  if (isPaletteColor(safe)) return PALETTE_COLORS[safe];
  return {
    bg: safe,
    dark: shadeColor(safe, 0.85),
    text: getContrastText(safe),
  };
};

export const toHexInputValue = (color?: string | null): string => {
  const safe = sanitizeNoteColor(color);
  if (isPaletteColor(safe)) return PALETTE_COLORS[safe].bg;
  return safe;
};
