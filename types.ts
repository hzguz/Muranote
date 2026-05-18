
import type { Timestamp } from 'firebase/firestore';

export type PaletteNoteColor =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'orange'
  | 'teal'
  | 'slate';
export type NoteType = 'note' | 'title';
export type TitleSize = 'small' | 'medium' | 'large';
export type Language = 'en';
export type LetterSealIcon = 'heart' | 'star' | 'sparkles' | 'flower' | 'moon' | 'sun' | 'feather' | 'gem';

export interface NoteData {
  id: string;
  type: NoteType; // 'note' or 'title'
  title: string;
  content: string; // Used for note content
  color: string;
  rating: number; // 0 to 5, only for notes

  // Title Fields
  icon?: string; // Icon name for titles
  titleSize?: TitleSize; // Font size preference

  // Grid/Kanban Fields
  columnId?: string;
  order?: number;

  x: number;
  y: number;
  zIndex: number;
  rotation: number;
  createdAt: number;
  updatedAt?: number; // Last modified timestamp
}

export interface ColumnData {
  id: string;
  title: string;
  icon?: string; // Icon name for column header
  x: number;
  y: number;
  zIndex: number;
  createdAt: number;
  updatedAt?: number;
}

export interface ExportData {
  version: number;
  appName: string;
  notes: NoteData[];
  columns?: ColumnData[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  avatarId?: string;
  matchCode: string; // 5 digit unique code
  matchStatus: 'none' | 'pending_sent' | 'pending_received' | 'matched';
  matchPartnerId?: string;
  matchPartnerName?: string;
  matchPartnerPhoto?: string;
  matchPartnerAvatarId?: string;
  noteColorPreference?: string;
  titleColorPreference?: string;
  matchRequestFrom?: string; // UID of the requester
  isBanned?: boolean; // Whether user is banned from using the app
  banReason?: string; // Custom ban message from admin
}

export interface LetterData {
  id: string;
  fromUid: string;
  toUid: string;
  sealIcon: LetterSealIcon;
  message: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}
