import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, User, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  writeBatch,
  getDoc,
  getDocs,
  where,
  updateDoc,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  QuerySnapshot,
  Firestore,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ColumnData, LetterData, LetterSealIcon, NoteData, UserProfile } from '../types';
import { sanitizeNoteData } from '../utils/noteSecurity';
import { AvatarId, getDefaultAvatarIdFromUid, isAvatarId } from '../utils/avatar';
import { DEFAULT_TYPE_COLORS, sanitizeNoteColor } from '../utils/noteColors';
import {
  LETTER_MAX_MESSAGE_LENGTH,
  LETTER_TTL_MS,
  sanitizeLetterMessage,
  sanitizeLetterSealIcon,
} from '../utils/letters';

const getEnv = (key: string): string => {
  return import.meta.env[key] || '';
};
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missingEnvKeys = requiredEnvKeys.filter((k) => !import.meta.env[k]);
const hasFirebaseEnv = missingEnvKeys.length === 0;

const app = hasFirebaseEnv ? initializeApp(firebaseConfig) : null;
const auth: Auth | null = app ? getAuth(app) : null;
const db: Firestore | null = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;

export { auth, db };

if (!hasFirebaseEnv) {
  console.error(
    `[muranote] Firebase desativado no ambiente local. Crie um .env com: ${missingEnvKeys.join(', ')}`
  );
}

const assertAuthConfigured = (): Auth => {
  if (!auth) {
    throw new Error('Firebase Auth não configurado. Preencha VITE_FIREBASE_* no .env.');
  }
  return auth;
};

const assertDbConfigured = (): Firestore => {
  if (!db) {
    throw new Error('Firebase Firestore não configurado. Preencha VITE_FIREBASE_* no .env.');
  }
  return db;
};

const cleanUndefined = (data: Record<string, any>) => {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
};

const normalizeColumnData = (column: Partial<ColumnData>, fallbackId?: string): ColumnData => {
  const now = Date.now();
  return {
    id: column.id || fallbackId || '',
    title: typeof column.title === 'string' && column.title.trim().length > 0 ? column.title : 'main',
    icon: typeof column.icon === 'string' ? column.icon : undefined,
    x: typeof column.x === 'number' ? column.x : 0,
    y: typeof column.y === 'number' ? column.y : 0,
    zIndex: typeof column.zIndex === 'number' ? column.zIndex : 1,
    createdAt: typeof column.createdAt === 'number' ? column.createdAt : now,
    updatedAt: typeof column.updatedAt === 'number' ? column.updatedAt : now,
  };
};

const normalizeLetterData = (letter: Partial<LetterData>, fallbackId?: string): LetterData | null => {
  const message = typeof letter.message === 'string' ? sanitizeLetterMessage(letter.message) : '';
  const createdAt = letter.createdAt;
  const expiresAt = letter.expiresAt;

  if (!letter.fromUid || !letter.toUid || !message) return null;
  if (!(createdAt instanceof Timestamp) || !(expiresAt instanceof Timestamp)) return null;

  return {
    id: letter.id || fallbackId || '',
    fromUid: letter.fromUid,
    toUid: letter.toUid,
    sealIcon: sanitizeLetterSealIcon(letter.sealIcon),
    message,
    createdAt,
    expiresAt,
  };
};

export interface PersistResult {
  ok: boolean;
  error?: Error;
}

const toError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Unknown error');
};

export const loginWithGoogle = async () => {
  const authInstance = assertAuthConfigured();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(authInstance, provider);
  await initializeUserProfile(result.user);
};

export const logout = async () => {
  await signOut(assertAuthConfigured());
};

export interface UserCapabilities {
  isAdmin: boolean;
}

export const getMyCapabilities = async (): Promise<UserCapabilities> => {
  const currentUser = assertAuthConfigured().currentUser;
  if (!currentUser) return { isAdmin: false };

  const tokenResult = await currentUser.getIdTokenResult(true);
  return { isAdmin: tokenResult.claims.admin === true };
};

const assertAdmin = async () => {
  const { isAdmin } = await getMyCapabilities();
  if (!isAdmin) {
    throw new Error('PERMISSION_DENIED: admin claim required.');
  }
};

export const getUsersPaginated = async (lastDoc: DocumentSnapshot | null, pageSize: number = 10) => {
  await assertAdmin();
  const database = assertDbConfigured();

  let q = query(collection(database, 'users'), orderBy('email'), limit(pageSize));

  if (lastDoc) {
    q = query(collection(database, 'users'), orderBy('email'), startAfter(lastDoc), limit(pageSize));
  }

  const documentSnapshots = await getDocs(q);

  const users: UserProfile[] = [];
  documentSnapshots.forEach((snapshotDoc) => {
    users.push(snapshotDoc.data() as UserProfile);
  });

  const lastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
  return { users, lastVisible };
};

const generateMatchCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

export const initializeUserProfile = async (user: User) => {
  const database = assertDbConfigured();
  const userRef = doc(database, 'users', user.uid);
  const snap = await getDoc(userRef);
  const defaultAvatar = getDefaultAvatarIdFromUid(user.uid);

  if (!snap.exists()) {
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      avatarId: defaultAvatar,
      noteColorPreference: DEFAULT_TYPE_COLORS.note,
      titleColorPreference: DEFAULT_TYPE_COLORS.title,
      matchCode: generateMatchCode(),
      matchStatus: 'none',
    };
    await setDoc(userRef, profile);
  } else {
    const data = snap.data();
    const updates: Record<string, any> = {};
    const safeNotePref = sanitizeNoteColor(data.noteColorPreference, DEFAULT_TYPE_COLORS.note);
    const safeTitlePref = sanitizeNoteColor(data.titleColorPreference, DEFAULT_TYPE_COLORS.title);
    if (!data.matchCode) updates.matchCode = generateMatchCode();
    if (!isAvatarId(data.avatarId)) updates.avatarId = defaultAvatar;
    if (data.noteColorPreference !== safeNotePref) updates.noteColorPreference = safeNotePref;
    if (data.titleColorPreference !== safeTitlePref) updates.titleColorPreference = safeTitlePref;
    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
    }
  }
};

export const updateUserAvatar = async (userId: string, avatarId: AvatarId) => {
  const database = assertDbConfigured();
  const userRef = doc(database, 'users', userId);
  await updateDoc(userRef, { avatarId });
};

export const updateUserColorPreferences = async (
  userId: string,
  prefs: Partial<Pick<UserProfile, 'noteColorPreference' | 'titleColorPreference'>>
) => {
  const database = assertDbConfigured();
  const userRef = doc(database, 'users', userId);
  const updates: Record<string, string> = {};

  if (prefs.noteColorPreference !== undefined) {
    updates.noteColorPreference = sanitizeNoteColor(prefs.noteColorPreference, DEFAULT_TYPE_COLORS.note);
  }
  if (prefs.titleColorPreference !== undefined) {
    updates.titleColorPreference = sanitizeNoteColor(prefs.titleColorPreference, DEFAULT_TYPE_COLORS.title);
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(userRef, updates);
  }
};

export const subscribeToUserProfile = (userId: string, callback: (profile: UserProfile | null) => void) => {
  const database = assertDbConfigured();
  return onSnapshot(
    doc(database, 'users', userId),
    (docSnap) => {
      if (docSnap.exists()) callback(docSnap.data() as UserProfile);
      else callback(null);
    },
    (error) => {
      console.error('Firestore profile subscription error:', error);
      callback(null);
    }
  );
};

export const banUser = async (userId: string, reason?: string) => {
  await assertAdmin();
  const database = assertDbConfigured();
  const userRef = doc(database, 'users', userId);
  await updateDoc(userRef, { isBanned: true, banReason: reason || null });
};

export const unbanUser = async (userId: string) => {
  await assertAdmin();
  const database = assertDbConfigured();
  const userRef = doc(database, 'users', userId);
  await updateDoc(userRef, { isBanned: false, banReason: null });
};

export const sendMatchRequest = async (currentUserId: string, targetCode: string) => {
  const database = assertDbConfigured();

  const q = query(collection(database, 'users'), where('matchCode', '==', targetCode));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Código não encontrado.');
  }

  const targetDoc = querySnapshot.docs[0];
  const targetUser = targetDoc.data() as UserProfile;

  if (targetUser.uid === currentUserId) {
    throw new Error('Você não pode dar match com você mesmo.');
  }
  if (targetUser.matchStatus === 'matched') {
    throw new Error('Este usuário já tem um match.');
  }

  const batch = writeBatch(database);
  const currentUserRef = doc(database, 'users', currentUserId);
  const targetUserRef = doc(database, 'users', targetUser.uid);

  batch.update(currentUserRef, {
    matchStatus: 'pending_sent',
    matchPartnerId: targetUser.uid,
  });

  batch.update(targetUserRef, {
    matchStatus: 'pending_received',
    matchRequestFrom: currentUserId,
  });

  await batch.commit();
};

export const acceptMatchRequest = async (currentUserId: string, requesterId: string) => {
  const database = assertDbConfigured();
  const currentUserRef = doc(database, 'users', currentUserId);
  const requesterRef = doc(database, 'users', requesterId);

  const requesterSnap = await getDoc(requesterRef);
  const currentUserSnap = await getDoc(currentUserRef);

  const requesterData = requesterSnap.data() as UserProfile;
  const currentUserData = currentUserSnap.data() as UserProfile;

  const batch = writeBatch(database);

  batch.update(currentUserRef, {
    matchStatus: 'matched',
    matchPartnerId: requesterId,
    matchPartnerName: requesterData.displayName,
    matchPartnerPhoto: requesterData.photoURL,
    matchPartnerAvatarId: requesterData.avatarId || null,
    matchRequestFrom: null,
  });

  batch.update(requesterRef, {
    matchStatus: 'matched',
    matchPartnerId: currentUserId,
    matchPartnerName: currentUserData.displayName,
    matchPartnerPhoto: currentUserData.photoURL,
    matchPartnerAvatarId: currentUserData.avatarId || null,
    matchRequestFrom: null,
  });

  await batch.commit();
};

export const declineMatchRequest = async (currentUserId: string, requesterId: string) => {
  const database = assertDbConfigured();
  const batch = writeBatch(database);
  const currentUserRef = doc(database, 'users', currentUserId);
  const requesterRef = doc(database, 'users', requesterId);

  batch.update(currentUserRef, { matchStatus: 'none', matchRequestFrom: null, matchPartnerId: null });
  batch.update(requesterRef, { matchStatus: 'none', matchPartnerId: null });

  await batch.commit();
};

export const unmatchUser = async (currentUserId: string, partnerId: string) => {
  const database = assertDbConfigured();
  const batch = writeBatch(database);
  const currentUserRef = doc(database, 'users', currentUserId);
  const partnerRef = doc(database, 'users', partnerId);

  batch.update(currentUserRef, { matchStatus: 'none', matchPartnerId: null, matchPartnerName: null, matchPartnerPhoto: null, matchPartnerAvatarId: null });
  batch.update(partnerRef, { matchStatus: 'none', matchPartnerId: null, matchPartnerName: null, matchPartnerPhoto: null, matchPartnerAvatarId: null });

  await batch.commit();
};

export const sendLetterToMatch = async (
  recipientId: string,
  message: string,
  sealIcon: LetterSealIcon
) => {
  const currentUser = assertAuthConfigured().currentUser;
  if (!currentUser) {
    throw new Error('voce precisa estar logado para enviar cartas.');
  }

  const cleanMessage = sanitizeLetterMessage(message);
  if (cleanMessage.length === 0) {
    throw new Error('escreva uma mensagem antes de enviar.');
  }
  if (cleanMessage.length > LETTER_MAX_MESSAGE_LENGTH) {
    throw new Error('a carta esta muito longa.');
  }

  const database = assertDbConfigured();
  const letterRef = doc(collection(database, `users/${recipientId}/letters`));
  const payload = {
    id: letterRef.id,
    fromUid: currentUser.uid,
    toUid: recipientId,
    sealIcon: sanitizeLetterSealIcon(sealIcon),
    message: cleanMessage,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + LETTER_TTL_MS),
  };

  await setDoc(letterRef, cleanUndefined(payload));
};

export const sendLetterAsAdmin = async (
  recipientId: string,
  message: string,
  sealIcon: LetterSealIcon
) => {
  const currentUser = assertAuthConfigured().currentUser;
  if (!currentUser) {
    throw new Error('você precisa estar logado para enviar cartas.');
  }

  const cleanMessage = sanitizeLetterMessage(message);
  if (cleanMessage.length === 0) {
    throw new Error('escreva uma mensagem antes de enviar.');
  }
  if (cleanMessage.length > LETTER_MAX_MESSAGE_LENGTH) {
    throw new Error('a carta está muito longa.');
  }

  const database = assertDbConfigured();
  const letterRef = doc(collection(database, `users/${recipientId}/letters`));
  const payload = {
    id: letterRef.id,
    fromUid: currentUser.uid,
    toUid: recipientId,
    sealIcon: sanitizeLetterSealIcon(sealIcon),
    message: cleanMessage,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + LETTER_TTL_MS),
  };

  await setDoc(letterRef, cleanUndefined(payload));
};

export const subscribeToIncomingLetters = (
  userId: string,
  callback: (letters: LetterData[]) => void,
  onError?: (error: Error) => void
) => {
  const database = assertDbConfigured();
  const q = query(collection(database, `users/${userId}/letters`), orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot) => {
      const letters: LetterData[] = [];
      snapshot.forEach((docSnap) => {
        const normalized = normalizeLetterData(docSnap.data() as Partial<LetterData>, docSnap.id);
        if (normalized?.id) {
          letters.push(normalized);
        }
      });
      callback(letters);
    },
    (error) => {
      console.error('Firestore letters subscription error:', error);
      if (onError) onError(toError(error));
      callback([]);
    }
  );
};

export const deleteLetter = async (userId: string, letterId: string) => {
  const database = assertDbConfigured();
  await deleteDoc(doc(database, `users/${userId}/letters`, letterId));
};

export const cleanupExpiredLetters = async (userId: string, letters: LetterData[]) => {
  const expired = letters.filter((letter) => letter.expiresAt.toMillis() <= Date.now());
  if (expired.length === 0) return;

  const database = assertDbConfigured();
  const batch = writeBatch(database);
  expired.forEach((letter) => {
    batch.delete(doc(database, `users/${userId}/letters`, letter.id));
  });
  await batch.commit();
};

export const subscribeToNotes = (userId: string, callback: (notes: NoteData[]) => void) => {
  const database = assertDbConfigured();
  const q = query(collection(database, `users/${userId}/notes`));

  const unsubscribe = onSnapshot(
    q,
    (snapshot: QuerySnapshot) => {
      const notes: NoteData[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data() as NoteData;
        const normalized = sanitizeNoteData({
          ...raw,
          id: raw.id || docSnap.id,
        });
        if (normalized.id) {
          notes.push(normalized);
        }
      });
      callback(notes);
    },
    (error) => {
      console.error('Firestore notes subscription error:', error);
      callback([]);
    }
  );

  return unsubscribe;
};

export const subscribeToColumns = (
  userId: string,
  callback: (columns: ColumnData[]) => void,
  onError?: (error: Error) => void
) => {
  const database = assertDbConfigured();
  const q = query(collection(database, `users/${userId}/columns`));

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot) => {
      const columns: ColumnData[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data() as Partial<ColumnData>;
        const normalized = normalizeColumnData(raw, docSnap.id);
        if (normalized.id) {
          columns.push(normalized);
        }
      });
      callback(columns);
    },
    (error) => {
      console.error('Firestore columns subscription error:', error);
      if (onError) onError(toError(error));
      callback([]);
    }
  );
};

export const saveNoteToCloud = async (userId: string, note: NoteData) => {
  const database = assertDbConfigured();
  await setDoc(doc(database, `users/${userId}/notes`, note.id), cleanUndefined(sanitizeNoteData(note)));
};

export const deleteNoteFromCloud = async (userId: string, noteId: string) => {
  const database = assertDbConfigured();
  await deleteDoc(doc(database, `users/${userId}/notes`, noteId));
};

export const syncLocalToCloud = async (userId: string, localNotes: NoteData[]) => {
  if (localNotes.length === 0) return;
  const database = assertDbConfigured();

  const batch = writeBatch(database);
  localNotes.forEach((note) => {
    const ref = doc(database, `users/${userId}/notes`, note.id);
    batch.set(ref, cleanUndefined(sanitizeNoteData(note)));
  });

  await batch.commit();
};

export const persistNoteChange = async (userId: string, note: NoteData): Promise<PersistResult> => {
  try {
    await saveNoteToCloud(userId, note);
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: toError(error) };
  }
};

export const persistNotesBatch = async (userId: string, notes: NoteData[]): Promise<PersistResult> => {
  if (notes.length === 0) return { ok: true };
  try {
    const database = assertDbConfigured();
    const batch = writeBatch(database);
    notes.forEach((note) => {
      const ref = doc(database, `users/${userId}/notes`, note.id);
      batch.set(ref, cleanUndefined(sanitizeNoteData(note)));
    });
    await batch.commit();
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: toError(error) };
  }
};

export const saveColumn = async (userId: string, column: ColumnData) => {
  const database = assertDbConfigured();
  const payload = normalizeColumnData(column);
  await setDoc(doc(database, `users/${userId}/columns`, payload.id), cleanUndefined(payload));
};

export const persistColumnChange = async (userId: string, column: ColumnData): Promise<PersistResult> => {
  try {
    await saveColumn(userId, column);
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: toError(error) };
  }
};

export const deleteColumn = async (userId: string, columnId: string) => {
  const database = assertDbConfigured();
  await deleteDoc(doc(database, `users/${userId}/columns`, columnId));
};

export const deleteColumnSafe = async (userId: string, columnId: string): Promise<PersistResult> => {
  try {
    await deleteColumn(userId, columnId);
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: toError(error) };
  }
};

export const syncLocalColumnsToCloud = async (
  userId: string,
  localColumns: ColumnData[]
): Promise<PersistResult> => {
  if (localColumns.length === 0) return { ok: true };
  try {
    const database = assertDbConfigured();
    const batch = writeBatch(database);
    localColumns.forEach((column) => {
      const normalized = normalizeColumnData(column);
      const ref = doc(database, `users/${userId}/columns`, normalized.id);
      batch.set(ref, cleanUndefined(normalized));
    });
    await batch.commit();
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: toError(error) };
  }
};
