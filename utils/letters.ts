import type { LetterSealIcon } from '../types';

export const LETTER_SEAL_ICONS: LetterSealIcon[] = [
  'heart',
  'star',
  'sparkles',
  'flower',
  'moon',
  'sun',
  'feather',
  'gem',
];

export const DEFAULT_LETTER_SEAL: LetterSealIcon = 'heart';
export const LETTER_MAX_MESSAGE_LENGTH = 2000;
export const LETTER_TTL_MS = 24 * 60 * 60 * 1000 - 5 * 60 * 1000;

export const isLetterSealIcon = (value: unknown): value is LetterSealIcon => {
  return typeof value === 'string' && LETTER_SEAL_ICONS.includes(value as LetterSealIcon);
};

export const sanitizeLetterSealIcon = (value: unknown): LetterSealIcon => {
  return isLetterSealIcon(value) ? value : DEFAULT_LETTER_SEAL;
};

export const sanitizeLetterMessage = (value: string): string => {
  return value.trim().slice(0, LETTER_MAX_MESSAGE_LENGTH);
};
