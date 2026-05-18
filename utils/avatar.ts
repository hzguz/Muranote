export const AVATAR_OPTIONS = ['fox', 'cat', 'panda', 'tiger', 'koala', 'rabbit', 'owl', 'bear'] as const;

export type AvatarId = (typeof AVATAR_OPTIONS)[number];

const AVATAR_EMOJI: Record<AvatarId, string> = {
  fox: '🦊',
  cat: '🐱',
  panda: '🐼',
  tiger: '🐯',
  koala: '🐨',
  rabbit: '🐰',
  owl: '🦉',
  bear: '🐻',
};

const AVATAR_BG: Record<AvatarId, string> = {
  fox: 'bg-amber-100',
  cat: 'bg-slate-100',
  panda: 'bg-zinc-100',
  tiger: 'bg-orange-100',
  koala: 'bg-stone-100',
  rabbit: 'bg-pink-100',
  owl: 'bg-indigo-100',
  bear: 'bg-yellow-100',
};

export const isAvatarId = (value: string | null | undefined): value is AvatarId => {
  return !!value && (AVATAR_OPTIONS as readonly string[]).includes(value);
};

export const getAvatarEmoji = (avatarId?: string | null): string => {
  if (isAvatarId(avatarId)) return AVATAR_EMOJI[avatarId];
  return AVATAR_EMOJI.fox;
};

export const getAvatarBgClass = (avatarId?: string | null): string => {
  if (isAvatarId(avatarId)) return AVATAR_BG[avatarId];
  return AVATAR_BG.fox;
};

export const getDefaultAvatarIdFromUid = (uid: string): AvatarId => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return AVATAR_OPTIONS[hash % AVATAR_OPTIONS.length];
};
