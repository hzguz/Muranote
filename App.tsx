import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, AlertTriangle, Target, WifiOff } from 'tabler-icons-react';
import { motion, AnimatePresence, LayoutGroup, useMotionValue, animate } from 'framer-motion';

import Note from './components/Note';
import NoteEditor from './components/NoteEditor';
import DataControl from './components/DataControl';
import AdminPanel from './components/AdminPanel';

import ColumnContainer from './components/ColumnContainer';
import Header from './components/Header';
import FABMenu from './components/FABMenu';
import NoteSkeleton from './components/NoteSkeleton';
import LetterComposer from './components/LetterComposer';
import LetterInbox from './components/LetterInbox';
import { DesktopGridPattern, EmptyStateParticles, EmptyStateFooter, EmptyStateMessage } from './components/EmptyState';
import { useLanguage } from './contexts/LanguageContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { LetterData, LetterSealIcon, NoteData, NoteType, ColumnData, UserProfile } from './types';
import { STORAGE_KEY, STORAGE_COLS_KEY, INITIAL_NOTE_WIDTH, INITIAL_NOTE_HEIGHT, TITLE_ICONS, ICON_STROKE_WIDTH } from './constants';
import {
    auth,
    loginWithGoogle,
    logout,
    subscribeToNotes,
    deleteNoteFromCloud,
    syncLocalToCloud,
    subscribeToUserProfile,
    initializeUserProfile,
    getMyCapabilities,
    subscribeToColumns,
    deleteColumnSafe,
    syncLocalColumnsToCloud,
    persistNoteChange,
    persistNotesBatch,
    persistColumnChange,
    subscribeToIncomingLetters,
    sendLetterToMatch,
    deleteLetter,
    cleanupExpiredLetters,
} from './services/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { sanitizeNoteData } from './utils/noteSecurity';
import { DEFAULT_TYPE_COLORS } from './utils/noteColors';
import { playSound } from './utils/audio';

interface AuthErrorState {
    title: string;
    message: string;
    instruction?: string;
}

type ViewMode = 'free' | 'grid';
const DEBUG_SYNC_KEY = 'muranote_debug_sync';

const isDebugSyncEnabled = (): boolean => {
    try {
        return localStorage.getItem(DEBUG_SYNC_KEY) === 'true';
    } catch {
        return false;
    }
};

const debugSyncLog = (...args: unknown[]) => {
    if (isDebugSyncEnabled()) {
        console.log('[muranote-sync]', ...args);
    }
};

const isPermissionDeniedError = (error: unknown): boolean => {
    const code = (error as { code?: string } | undefined)?.code;
    return code === 'permission-denied' || code === 'firestore/permission-denied';
};

const normalizeColumn = (raw: Partial<ColumnData>, fallbackId?: string, fallbackTitle: string = 'main'): ColumnData => {
    const now = Date.now();
    return {
        id: raw.id || fallbackId || `col-${now}`,
        title: typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title : fallbackTitle,
        icon: typeof raw.icon === 'string' ? raw.icon : undefined,
        x: typeof raw.x === 'number' ? raw.x : 0,
        y: typeof raw.y === 'number' ? raw.y : 0,
        zIndex: typeof raw.zIndex === 'number' ? raw.zIndex : 1,
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    };
};

const MIN_CANVAS_SCALE = 0.1;
const MAX_CANVAS_SCALE = 3;

function App() {
    const { lang, setLang, t } = useLanguage();
    const isOnline = useOnlineStatus();
    const [notes, setNotes] = useState<NoteData[]>([]);

    // Helper to get column storage key based on context
    const getColumnsStorageKey = (uid?: string) => uid ? `${STORAGE_COLS_KEY}_${uid}` : STORAGE_COLS_KEY;

    const defaultColumns = (): ColumnData[] => [{ id: 'default-col', title: t.colDefault || 'principal', x: 0, y: 0, zIndex: 1, createdAt: Date.now() }];

    const [columns, setColumns] = useState<ColumnData[]>(() => {
        // Initial load from localStorage (no user context yet)
        const saved = localStorage.getItem(STORAGE_COLS_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.map((c: any) => ({
                    ...c,
                    x: c.x ?? 0,
                    y: c.y ?? 0,
                    zIndex: c.zIndex ?? 1,
                    createdAt: c.createdAt ?? Date.now()
                }));
            } catch (e) {
                console.error('Failed to parse columns from localStorage:', e);
            }
        }
        return defaultColumns();
    });
    const [activeNote, setActiveNote] = useState<NoteData | null>(null);
    const [isDataModalOpen, setIsDataModalOpen] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
    const [maxZIndex, setMaxZIndex] = useState(10);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [viewMode, setViewMode] = useState<ViewMode>('free');
    const [currentStroke, setCurrentStroke] = useState(ICON_STROKE_WIDTH.desktop);

    const viewportX = useMotionValue(0);
    const viewportY = useMotionValue(0);
    const viewportScale = useMotionValue(1);
    const [isPanning, setIsPanning] = useState(false);
    const [showResetView, setShowResetView] = useState(false);

    const [isLoadingNotes, setIsLoadingNotes] = useState(true);

    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [, setIsSyncing] = useState(false);
    const [authError, setAuthError] = useState<AuthErrorState | null>(null);

    const [viewingPartner, setViewingPartner] = useState(false);
    const [spyTarget, setSpyTarget] = useState<{ id: string, name: string } | null>(null);

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
    const [syncNotice, setSyncNotice] = useState<string | null>(null);
    const [incomingLetters, setIncomingLetters] = useState<LetterData[]>([]);
    const [isLetterComposerOpen, setIsLetterComposerOpen] = useState(false);

    // Ref to store user's columns when switching to match/spy view
    const userColumnsRef = useRef<ColumnData[]>([]);
    const healedIdsRef = useRef<Set<string>>(new Set());
    const notesSubscriptionVersionRef = useRef(0);
    const columnsSubscriptionVersionRef = useRef(0);
    const notesRef = useRef<NoteData[]>([]);
    const loadedNotesOwnerRef = useRef<string | null>(null);
    const lastColumnSyncUserRef = useRef<string | null>(null);
    const notePersistTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const queuedNotePersistRef = useRef<Map<string, NoteData>>(new Map());
    const columnsPermissionDeniedRef = useRef(false);
    // Flag to prevent notes save before load completes
    const hasLoadedNotesRef = useRef(false);
    const hasLoadedColumnsRef = useRef(false);
    const prevLetterCountRef = useRef<number>(0);
    const notificationVolumeRef = useRef<number>(0.5);

    // Reading filter state (0 = off, 1-50 = intensity)
    const [readingFilterIntensity, setReadingFilterIntensity] = useState(() => {
        const saved = localStorage.getItem('muranote_reading_filter');
        return saved ? JSON.parse(saved) : 0;
    });

    const [notificationVolume, setNotificationVolume] = useState<number>(() => {
        const stored = localStorage.getItem('muranote_sound_volume');
        const value = stored !== null ? parseFloat(stored) : 0.5;
        notificationVolumeRef.current = value;
        return value;
    });

    const handleVolumeChange = useCallback((volume: number) => {
        setNotificationVolume(volume);
        notificationVolumeRef.current = volume;
        localStorage.setItem('muranote_sound_volume', String(volume));
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);

    const isGridMode = isMobile ? true : viewMode === 'grid';
    const isReadOnly = viewingPartner;
    const isOwnerView = !!user && !viewingPartner && !spyTarget;
    const activeOwnerId = useMemo(() => {
        if (spyTarget?.id) return spyTarget.id;
        if (viewingPartner) return userProfile?.matchPartnerId || null;
        return user?.uid || null;
    }, [spyTarget?.id, viewingPartner, userProfile?.matchPartnerId, user?.uid]);
    const writableOwnerId = useMemo(() => {
        if (!user) return null;
        if (viewingPartner && !spyTarget) return null;
        return spyTarget?.id || user.uid;
    }, [user, viewingPartner, spyTarget?.id]);
    const validColumnIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);
    const defaultColumnId = columns[0]?.id;
    const orphanedNotes = useMemo(
        () => notes.filter((n) => !!n.columnId && !validColumnIds.has(n.columnId)),
        [notes, validColumnIds]
    );
    const freeCanvasNotes = useMemo(
        () => notes.filter((n) => !n.columnId || !validColumnIds.has(n.columnId)),
        [notes, validColumnIds]
    );

    const CANVAS_COL_ID = 'canvas-notes-mobile';
    const canvasColVirtual = useMemo<ColumnData>(() => ({
        id: CANVAS_COL_ID,
        title: t.colCanvas,
        x: 0,
        y: 0,
        zIndex: 1,
        createdAt: 0,
    }), [t.colCanvas]);
    useEffect(() => {
        setColumns(cols => cols.map(c => c.id === 'default-col' ? { ...c, title: t.colDefault } : c));
    }, [lang, t.colDefault]);

    useEffect(() => {
        notesRef.current = notes;
    }, [notes]);

    useEffect(() => {
        if (!syncNotice) return;
        const timer = setTimeout(() => setSyncNotice(null), 3500);
        return () => clearTimeout(timer);
    }, [syncNotice]);

    useEffect(() => {
        columnsPermissionDeniedRef.current = false;
    }, [user?.uid]);


    useEffect(() => {
        const calculateStroke = () => {
            const w = window.innerWidth;
            if (w < 768) setCurrentStroke(ICON_STROKE_WIDTH.mobile);
            else if (w < 1024) setCurrentStroke(ICON_STROKE_WIDTH.tablet);
            else setCurrentStroke(ICON_STROKE_WIDTH.desktop);
        };
        calculateStroke();
        window.addEventListener('resize', calculateStroke);
        return () => window.removeEventListener('resize', calculateStroke);
    }, []);

    useEffect(() => {
        const unsubscribeX = viewportX.on("change", (latestX) => {
            const dist = Math.sqrt(latestX * latestX + viewportY.get() * viewportY.get());
            setShowResetView(dist > 500);
        });
        const unsubscribeY = viewportY.on("change", (latestY) => {
            const dist = Math.sqrt(viewportX.get() * viewportX.get() + latestY * latestY);
            setShowResetView(dist > 500);
        });
        return () => { unsubscribeX(); unsubscribeY(); };
    }, [viewportX, viewportY]);

    const handleResetView = () => {
        animate(viewportX, 0, { type: "spring", stiffness: 200, damping: 25 });
        animate(viewportY, 0, { type: "spring", stiffness: 200, damping: 25 });
        animate(viewportScale, 1, { type: "spring", stiffness: 200, damping: 25 });
    };

    const applyZoom = useCallback((nextScale: number, originX: number, originY: number) => {
        const clamped = Math.max(MIN_CANVAS_SCALE, Math.min(MAX_CANVAS_SCALE, nextScale));
        const ratio = clamped / viewportScale.get();
        viewportX.set(originX - (originX - viewportX.get()) * ratio);
        viewportY.set(originY - (originY - viewportY.get()) * ratio);
        viewportScale.set(clamped);
    }, [viewportScale, viewportX, viewportY]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            if (isGridMode) return;
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const originX = e.clientX - rect.left;
            const originY = e.clientY - rect.top;
            const delta = e.deltaY * -0.001;
            const next = viewportScale.get() * (1 + delta);
            applyZoom(next, originX, originY);
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [isGridMode, applyZoom, viewportScale]);

    const readLocalNotes = useCallback((): NoteData[] => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];
        try {
            const parsed = JSON.parse(saved) as NoteData[];
            return parsed
                .map((rawNote, index) => {
                    const sanitized = sanitizeNoteData(rawNote);
                    if (sanitized.id) return sanitized;
                    const fallbackId = `legacy-${sanitized.createdAt || Date.now()}-${index}`;
                    return { ...sanitized, id: fallbackId };
                })
                .filter((note) => !!note.id);
        } catch (e) {
            console.error('Failed to parse notes from localStorage:', e);
            return [];
        }
    }, []);

    const readLocalColumns = useCallback((uid?: string): ColumnData[] => {
        const key = uid ? getColumnsStorageKey(uid) : STORAGE_COLS_KEY;
        const saved = localStorage.getItem(key);
        if (!saved) return defaultColumns();
        try {
            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed) || parsed.length === 0) return defaultColumns();
            const normalized = parsed.map((raw: Partial<ColumnData>) =>
                normalizeColumn(raw, raw.id, t.colDefault || 'principal')
            );
            return normalized.length > 0 ? normalized : defaultColumns();
        } catch (e) {
            console.error('Failed to parse columns from localStorage:', e);
            return defaultColumns();
        }
    }, [t.colDefault]);

    useEffect(() => {
        let unsubscribeProfile: () => void = () => { };

        if (auth) {
            const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser: FirebaseUser | null) => {
                setUser(currentUser);
                if (currentUser) {
                    try {
                        await initializeUserProfile(currentUser);
                    } catch (e) {
                        console.error('Failed to initialize user profile:', e);
                    }
                    try {
                        const caps = await getMyCapabilities();
                        setIsAdmin(caps.isAdmin);
                    } catch (e) {
                        console.error('Failed to resolve user capabilities:', e);
                        setIsAdmin(false);
                    }

                    unsubscribeProfile = subscribeToUserProfile(currentUser.uid, (profile) => {
                        setUserProfile(profile);
                        setViewingPartner((prev) => (prev && profile?.matchStatus !== 'matched' ? false : prev));
                    });

                    const localNotes = readLocalNotes();
                    if (localNotes.length > 0) {
                        setIsSyncing(true);
                        try {
                            await syncLocalToCloud(currentUser.uid, localNotes);
                            localStorage.removeItem(STORAGE_KEY);
                        } catch (e) {
                            console.error('Failed to sync local notes:', e);
                        } finally {
                            setIsSyncing(false);
                        }
                    }
                } else {
                    unsubscribeProfile();
                    setUserProfile(null);
                    setViewingPartner(false);
                    setSpyTarget(null);
                    setIsAdmin(false);
                    const localNotes = readLocalNotes();
                    loadedNotesOwnerRef.current = null;
                    setNotes(localNotes);
                    const zIndices = localNotes.map((n) => n.zIndex);
                    setMaxZIndex(zIndices.length > 0 ? Math.max(...zIndices) + 1 : 10);
                    hasLoadedNotesRef.current = true;
                    setIsLoadingNotes(false);
                }
            });
            return () => {
                unsubscribeAuth();
                unsubscribeProfile();
            };
        }

        const localNotes = readLocalNotes();
    loadedNotesOwnerRef.current = null;
        setNotes(localNotes);
        const zIndices = localNotes.map((n) => n.zIndex);
        setMaxZIndex(zIndices.length > 0 ? Math.max(...zIndices) + 1 : 10);
        hasLoadedNotesRef.current = true;
        setIsLoadingNotes(false);
    }, [readLocalNotes]);

    useEffect(() => {
        if (!user?.uid) {
            setIncomingLetters([]);
            return;
        }

        const unsubscribe = subscribeToIncomingLetters(
            user.uid,
            (letters) => {
                if (letters.length > prevLetterCountRef.current) {
                    playSound('/sounds/notification.mp3', notificationVolumeRef.current);
                }
                prevLetterCountRef.current = letters.length;
                setIncomingLetters(letters);
                void cleanupExpiredLetters(user.uid, letters).catch((error) => {
                    console.error('Failed to cleanup expired letters:', error);
                });
            },
            (error) => {
                console.error('Failed to subscribe to letters:', error);
            }
        );

        return unsubscribe;
    }, [user?.uid]);

    useEffect(() => {
        if (!user) return;

        if (!activeOwnerId) {
            debugSyncLog('notes subscription waiting for activeOwnerId', { viewingPartner, matchPartnerId: userProfile?.matchPartnerId });
            loadedNotesOwnerRef.current = null;
            setNotes([]);
            setIsLoadingNotes(true);
            return;
        }

        const version = ++notesSubscriptionVersionRef.current;
        debugSyncLog('subscribe notes', { ownerId: activeOwnerId, version });
        loadedNotesOwnerRef.current = null;
        setIsLoadingNotes(true);

        const unsubscribe = subscribeToNotes(activeOwnerId, (incomingNotes) => {
            if (version !== notesSubscriptionVersionRef.current) {
                debugSyncLog('drop stale note snapshot', { version, current: notesSubscriptionVersionRef.current });
                return;
            }
            loadedNotesOwnerRef.current = activeOwnerId;
            setNotes(incomingNotes);
            const zIndices = incomingNotes.map((n) => n.zIndex);
            setMaxZIndex(zIndices.length > 0 ? Math.max(...zIndices) + 1 : 10);
            hasLoadedNotesRef.current = true;
            setIsLoadingNotes(false);
        });

        return () => {
            debugSyncLog('unsubscribe notes', { ownerId: activeOwnerId, version });
            unsubscribe();
        };
    }, [user?.uid, activeOwnerId, viewingPartner, userProfile?.matchPartnerId]);

    useEffect(() => {
        healedIdsRef.current.clear();
    }, [activeOwnerId, defaultColumnId]);

    useEffect(() => {
        if (isGridMode) { viewportX.set(0); viewportY.set(0); }
    }, [isGridMode, viewportX, viewportY]);

    const handleLogin = async () => { try { await loginWithGoogle(); } catch (error: unknown) { console.error(error); } };

    useEffect(() => {
        if (!user && hasLoadedNotesRef.current) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.map(sanitizeNoteData)));
        }
    }, [notes, user]);

    // Save columns backup locally (including cloud-driven mode).
    useEffect(() => {
        if (viewingPartner || spyTarget || columns.length === 0) return;
        const key = user ? getColumnsStorageKey(user.uid) : STORAGE_COLS_KEY;
        localStorage.setItem(key, JSON.stringify(columns));
        userColumnsRef.current = columns;
    }, [columns, user, viewingPartner, spyTarget]);

        // Load and subscribe columns by active context (owner, partner or spy target).
    useEffect(() => {
        let unsubscribe = () => { };

        // Anonymous users: localStorage fallback only.
        if (!user) {
            const localColumns = readLocalColumns();
            setColumns(localColumns);
            userColumnsRef.current = localColumns;
            hasLoadedColumnsRef.current = true;
            return () => { };
        }

        const ownerId = spyTarget?.id || (viewingPartner ? userProfile?.matchPartnerId : user.uid) || null;
        const isOwnerContext = ownerId === user.uid && !viewingPartner && !spyTarget;

        if (!ownerId) {
            setColumns(defaultColumns());
            hasLoadedColumnsRef.current = true;
            return () => { };
        }

        if (isOwnerContext && columnsPermissionDeniedRef.current) {
            const localColumns = readLocalColumns(user.uid);
            setColumns(localColumns);
            userColumnsRef.current = localColumns;
            hasLoadedColumnsRef.current = true;
            return () => { };
        }

        const version = ++columnsSubscriptionVersionRef.current;
        const ownerKey = getColumnsStorageKey(user.uid);
        debugSyncLog('subscribe columns', { ownerId, version, isOwnerContext });

        unsubscribe = subscribeToColumns(
            ownerId,
            async (incomingColumns) => {
                if (version !== columnsSubscriptionVersionRef.current) {
                    debugSyncLog('drop stale column snapshot', { version, current: columnsSubscriptionVersionRef.current });
                    return;
                }

                const normalized = incomingColumns
                    .map((col) => normalizeColumn(col, col.id, t.colDefault || 'principal'))
                    .filter((col) => !!col.id)
                    .sort((a, b) => a.createdAt - b.createdAt);

                if (normalized.length > 0) {
                    setColumns(normalized);
                    hasLoadedColumnsRef.current = true;
                    if (isOwnerContext) {
                        userColumnsRef.current = normalized;
                        localStorage.setItem(ownerKey, JSON.stringify(normalized));
                        lastColumnSyncUserRef.current = user.uid;
                    }
                    return;
                }

                if (!isOwnerContext) {
                    setColumns(defaultColumns());
                    hasLoadedColumnsRef.current = true;
                    return;
                }

                const localColumns = readLocalColumns(user.uid);
                const seedColumns = localColumns.length > 0 ? localColumns : defaultColumns();
                const seeded = seedColumns.map((col) => normalizeColumn(col, col.id, t.colDefault || 'principal'));
                setColumns(seeded);
                userColumnsRef.current = seeded;
                localStorage.setItem(ownerKey, JSON.stringify(seeded));
                hasLoadedColumnsRef.current = true;

                if (lastColumnSyncUserRef.current !== user.uid) {
                    lastColumnSyncUserRef.current = user.uid;
                    const syncResult = await syncLocalColumnsToCloud(user.uid, seeded);
                    if (!syncResult.ok) {
                        const denied = isPermissionDeniedError(syncResult.error);
                        if (denied) {
                            columnsPermissionDeniedRef.current = true;
                            setSyncNotice('Sem permissao para sincronizar colunas na nuvem.');
                            return;
                        }
                        lastColumnSyncUserRef.current = null;
                        console.error('Failed to sync local columns to cloud:', syncResult.error);
                        setSyncNotice('Não foi possível sincronizar as colunas agora.');
                    } else {
                        debugSyncLog('seeded cloud columns from local backup', { uid: user.uid, count: seeded.length });
                    }
                }
            },
            (error) => {
                if (!isPermissionDeniedError(error)) return;

                if (isOwnerContext) {
                    columnsPermissionDeniedRef.current = true;
                    const localColumns = readLocalColumns(user.uid);
                    setColumns(localColumns);
                    userColumnsRef.current = localColumns;
                    hasLoadedColumnsRef.current = true;
                    setSyncNotice('Sem permissao para ler colunas na nuvem.');
                    return;
                }

                setColumns(defaultColumns());
                hasLoadedColumnsRef.current = true;
                setSyncNotice('Sem permissao para visualizar colunas deste usuario.');
            }
        );

        return () => {
            debugSyncLog('unsubscribe columns', { ownerId, version });
            unsubscribe();
        };
    }, [user?.uid, viewingPartner, spyTarget?.id, userProfile?.matchPartnerId, readLocalColumns, t.colDefault]);

    // Save reading filter settings
    useEffect(() => {
        localStorage.setItem('muranote_reading_filter', JSON.stringify(readingFilterIntensity));
    }, [readingFilterIntensity]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const persistSingleNote = useCallback(async (note: NoteData): Promise<boolean> => {
        if (!writableOwnerId) return true;
        const result = await persistNoteChange(writableOwnerId, note);
        if (!result.ok) {
            console.error('Note persist failed:', result.error);
            setSyncNotice('Não foi possível salvar a nota. Tentando novamente.');
            return false;
        }
        return true;
    }, [writableOwnerId]);

    const persistNoteBatchSafe = useCallback(async (batchNotes: NoteData[]): Promise<boolean> => {
        if (!writableOwnerId || batchNotes.length === 0) return true;
        const result = await persistNotesBatch(writableOwnerId, batchNotes);
        if (!result.ok) {
            console.error('Notes batch persist failed:', result.error);
            setSyncNotice('Não foi possível salvar as alterações das notas.');
            return false;
        }
        return true;
    }, [writableOwnerId]);

    const persistColumnSafe = useCallback(async (column: ColumnData): Promise<boolean> => {
        if (!writableOwnerId) return true;
        if (columnsPermissionDeniedRef.current) {
            setSyncNotice('Sem permissão para salvar colunas na nuvem. Verifique as regras do Firestore.');
            return false;
        }
        const result = await persistColumnChange(writableOwnerId, column);
        if (!result.ok) {
            if (isPermissionDeniedError(result.error)) {
                columnsPermissionDeniedRef.current = true;
                setSyncNotice('Sem permissão para salvar colunas na nuvem. Verifique as regras do Firestore.');
                return false;
            }
            console.error('Column persist failed:', result.error);
            setSyncNotice('Não foi possível salvar a coluna.');
            return false;
        }
        return true;
    }, [writableOwnerId]);

    const queueNotePersist = useCallback((note: NoteData, delayMs: number = 200) => {
        if (!writableOwnerId) return;
        queuedNotePersistRef.current.set(note.id, note);
        const existingTimer = notePersistTimersRef.current.get(note.id);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(async () => {
            const queued = queuedNotePersistRef.current.get(note.id);
            if (!queued) return;
            const ok = await persistSingleNote(queued);
            if (ok) queuedNotePersistRef.current.delete(note.id);
            notePersistTimersRef.current.delete(note.id);
        }, delayMs);

        notePersistTimersRef.current.set(note.id, timer);
    }, [persistSingleNote, writableOwnerId]);

    const flushQueuedNotePersist = useCallback(async (noteId: string) => {
        const pending = queuedNotePersistRef.current.get(noteId);
        const existingTimer = notePersistTimersRef.current.get(noteId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            notePersistTimersRef.current.delete(noteId);
        }
        if (!pending) return true;
        const ok = await persistSingleNote(pending);
        if (ok) queuedNotePersistRef.current.delete(noteId);
        return ok;
    }, [persistSingleNote]);

    useEffect(() => {
        return () => {
            notePersistTimersRef.current.forEach((timer) => clearTimeout(timer));
            notePersistTimersRef.current.clear();
            queuedNotePersistRef.current.clear();
        };
    }, []);

    useEffect(() => {
        if (!isOwnerView || !defaultColumnId || !hasLoadedColumnsRef.current) return;
        if (!writableOwnerId) return;
        if (loadedNotesOwnerRef.current !== writableOwnerId) {
            debugSyncLog('skip orphan heal: notes owner not ready', {
                loadedOwner: loadedNotesOwnerRef.current,
                writableOwnerId,
            });
            return;
        }
        if (orphanedNotes.length === 0) return;

        const pendingOrphans = orphanedNotes.filter((note) => !healedIdsRef.current.has(note.id));
        if (pendingOrphans.length === 0) return;

        const previousNotes = notesRef.current;
        const timestamp = Date.now();
        const pendingIds = new Set(pendingOrphans.map((n) => n.id));
        const healedPayload = pendingOrphans.map((note) => ({
            ...note,
            columnId: defaultColumnId,
            updatedAt: timestamp,
        }));

        debugSyncLog('orphan notes detected', { count: healedPayload.length });
        setNotes((prev) =>
            prev.map((note) =>
                pendingIds.has(note.id) ? { ...note, columnId: defaultColumnId, updatedAt: timestamp } : note
            )
        );

        void (async () => {
            const ok = await persistNoteBatchSafe(healedPayload);
            if (!ok) {
                setNotes(previousNotes);
                return;
            }
            healedPayload.forEach((note) => healedIdsRef.current.add(note.id));
            debugSyncLog('orphan notes healed', { healed: healedPayload.length });
        })();
    }, [isOwnerView, orphanedNotes, defaultColumnId, persistNoteBatchSafe, writableOwnerId]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isGridMode || activeNote) return;
        if (e.button === 1) { e.preventDefault(); setIsPanning(true); }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isPanning) { e.preventDefault(); viewportX.set(viewportX.get() + e.movementX); viewportY.set(viewportY.get() + e.movementY); }
    };

    const handlePointerUp = () => setIsPanning(false);

    const addColumn = useCallback(() => {
        if (isReadOnly && !spyTarget) return;
        const previousColumns = [...columns];
        const timestamp = Date.now();
        const newCol: ColumnData = {
            id: uuidv4(),
            title: t.colNew,
            x: (window.innerWidth / 2) - viewportX.get() - 250,
            y: (window.innerHeight / 2) - viewportY.get() - 250,
            zIndex: maxZIndex + 1,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        setColumns((prev) => [...prev, newCol]);
        setMaxZIndex((prev) => prev + 1);
        setIsFabMenuOpen(false);

        if (!writableOwnerId) return;
        void (async () => {
            const ok = await persistColumnSafe(newCol);
            if (!ok) {
                setColumns(previousColumns);
                setMaxZIndex((prev) => Math.max(10, prev - 1));
            }
        })();
    }, [columns, isReadOnly, spyTarget, t.colNew, viewportX, viewportY, maxZIndex, writableOwnerId, persistColumnSafe]);

    const removeColumn = useCallback((colId: string) => {
        if (columns.length <= 1 || (isReadOnly && !spyTarget)) return;

        const previousColumns = [...columns];
        const previousNotes = [...notesRef.current];
        const newColumns = columns.filter((col) => col.id !== colId);
        const targetColId = newColumns[0]?.id || defaultColumnId;
        if (!targetColId) return;

        const timestamp = Date.now();
        const remappedNotes = previousNotes
            .filter((note) => note.columnId === colId)
            .map((note) => ({ ...note, columnId: targetColId, updatedAt: timestamp }));

        setColumns(newColumns);
        if (remappedNotes.length > 0) {
            const remapIds = new Set(remappedNotes.map((note) => note.id));
            setNotes((prev) =>
                prev.map((note) => (remapIds.has(note.id) ? { ...note, columnId: targetColId, updatedAt: timestamp } : note))
            );
        }

        if (!writableOwnerId) return;
        void (async () => {
            const notesOk = await persistNoteBatchSafe(remappedNotes);
            const deleteResult = await deleteColumnSafe(writableOwnerId, colId);
            if (!notesOk || !deleteResult.ok) {
                console.error('Failed to remove column in cloud:', deleteResult.error);
                setSyncNotice('Não foi possível remover a coluna. Estado restaurado.');
                setColumns(previousColumns);
                setNotes(previousNotes);
            }
        })();
    }, [columns, isReadOnly, spyTarget, defaultColumnId, writableOwnerId, persistNoteBatchSafe]);

    // --- LÓGICA UNIFICADA DE DROP ---
    // Funciona para: Modo Livre, Modo Grid, Desktop e Mobile
    const handleGridDrop = useCallback((noteId: string, point: { x: number, y: number }, finalPos?: { x: number, y: number }, dragOffset?: { x: number, y: number }) => {
        if (isReadOnly && !spyTarget) return;
        setDraggingId(null);
        setDragOverColumnId(null);

        const elements = document.elementsFromPoint(point.x, point.y);
        const targetNoteEl = elements.find((el) => el.getAttribute('data-note-id') && el.getAttribute('data-note-id') !== noteId);
        let targetColEl = elements.find((el) => el.getAttribute('data-column-id'));

        if (!targetColEl) {
            const allColumnEls = document.querySelectorAll('[data-column-id]');
            allColumnEls.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
                    targetColEl = el;
                }
            });

            if (!targetColEl) {
                let nearestEl: Element | null = null;
                let nearestDistance = Number.POSITIVE_INFINITY;
                allColumnEls.forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const distance = Math.hypot(point.x - cx, point.y - cy);
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestEl = el;
                    }
                });
                if (nearestEl && nearestDistance <= 64) {
                    targetColEl = nearestEl;
                }
            }
        }

        const targetNoteId = targetNoteEl?.getAttribute('data-note-id') || null;
        const currentNotes = notesRef.current;
        const sourceNote = currentNotes.find((note) => note.id === noteId);
        if (!sourceNote) return;

        let targetColId = targetColEl?.getAttribute('data-column-id') || dragOverColumnId || null;
        if (targetNoteId && !targetColId) {
            const targetNoteForColumn = currentNotes.find((note) => note.id === targetNoteId);
            if (targetNoteForColumn?.columnId) targetColId = targetNoteForColumn.columnId;
        }

        const sourceColId = sourceNote.columnId;
        const targetNote = targetNoteId ? currentNotes.find((note) => note.id === targetNoteId) : null;
        const nextZ = maxZIndex + 1;
        const rollbackSnapshot = currentNotes.map((note) => ({ ...note }));
        let updatedNotes = currentNotes;
        let changedNotes: NoteData[] = [];
        let mode: 'swap' | 'insert' | 'release' | 'move' | null = null;

        if (targetNote && sourceColId && sourceColId === targetNote.columnId) {
            const sourceIndex = currentNotes.findIndex((note) => note.id === noteId);
            const targetIndex = currentNotes.findIndex((note) => note.id === targetNote.id);
            if (sourceIndex === -1 || targetIndex === -1) return;

            const sourceUpdated = { ...currentNotes[sourceIndex], order: currentNotes[targetIndex].order, updatedAt: Date.now() };
            const targetUpdated = { ...currentNotes[targetIndex], order: currentNotes[sourceIndex].order, updatedAt: Date.now() };
            updatedNotes = [...currentNotes];
            updatedNotes[sourceIndex] = sourceUpdated;
            updatedNotes[targetIndex] = targetUpdated;
            changedNotes = [sourceUpdated, targetUpdated];
            mode = 'swap';
        } else if (targetColId) {
            const colNotes = currentNotes
                .filter((note) => note.columnId === targetColId && note.id !== noteId)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const newOrder = colNotes.length > 0 ? (colNotes[colNotes.length - 1].order || 0) + 1000 : Date.now();
            const updated = { ...sourceNote, columnId: targetColId, order: newOrder, zIndex: nextZ, updatedAt: Date.now() };
            updatedNotes = currentNotes.map((note) => (note.id === noteId ? updated : note));
            changedNotes = [updated];
            mode = 'insert';
        } else if (!isGridMode && sourceColId) {
            const vx = viewportX.get();
            const vy = viewportY.get();
            const offsetX = dragOffset?.x ?? 0;
            const offsetY = dragOffset?.y ?? 0;
            const x = point.x - vx - offsetX;
            const y = point.y - vy - offsetY;
            const updated = { ...sourceNote, x, y, columnId: undefined, zIndex: nextZ, updatedAt: Date.now() };
            updatedNotes = currentNotes.map((note) => (note.id === noteId ? updated : note));
            changedNotes = [updated];
            mode = 'release';
        } else if (!isGridMode && !sourceColId) {
            const x = finalPos?.x ?? point.x;
            const y = finalPos?.y ?? point.y;
            const updated = { ...sourceNote, x, y, zIndex: nextZ, updatedAt: Date.now() };
            updatedNotes = currentNotes.map((note) => (note.id === noteId ? updated : note));
            changedNotes = [updated];
            mode = 'move';
        }

        if (!mode || changedNotes.length === 0) return;

        setNotes(updatedNotes);
        setMaxZIndex((prev) => Math.max(prev, nextZ));

        if (!writableOwnerId) return;
        if (mode === 'move') {
            queueNotePersist(changedNotes[0], 180);
            return;
        }

        void (async () => {
            const persisted = await persistNoteBatchSafe(changedNotes);
            if (!persisted) {
                setNotes(rollbackSnapshot);
            }
        })();
    }, [isReadOnly, spyTarget, isMobile, isGridMode, dragOverColumnId, maxZIndex, viewportX, viewportY, writableOwnerId, queueNotePersist, persistNoteBatchSafe]);

    const handleNoteSwap = useCallback((sourceId: string, targetId: string) => {
        if (isReadOnly && !spyTarget) return;
        const currentNotes = notesRef.current;
        const sourceIndex = currentNotes.findIndex((note) => note.id === sourceId);
        const targetIndex = currentNotes.findIndex((note) => note.id === targetId);
        if (sourceIndex === -1 || targetIndex === -1) return;

        const sourceNote = { ...currentNotes[sourceIndex], order: currentNotes[targetIndex].order, updatedAt: Date.now() };
        const targetNote = { ...currentNotes[targetIndex], order: currentNotes[sourceIndex].order, updatedAt: Date.now() };
        const rollbackSnapshot = currentNotes.map((note) => ({ ...note }));
        const updated = [...currentNotes];
        updated[sourceIndex] = sourceNote;
        updated[targetIndex] = targetNote;
        setNotes(updated);

        if (!writableOwnerId) return;
        void (async () => {
            const ok = await persistNoteBatchSafe([sourceNote, targetNote]);
            if (!ok) setNotes(rollbackSnapshot);
        })();
    }, [isReadOnly, spyTarget, writableOwnerId, persistNoteBatchSafe]);

    const createItem = useCallback(async (type: NoteType) => {
        if (isReadOnly && !spyTarget) return;
        const defaultColor = DEFAULT_TYPE_COLORS[type];
        const randomRotation = (Math.random() * 6) - 3;
        let x = 0;
        let y = 0;
        if (!isGridMode) {
            x = (window.innerWidth / 2) - viewportX.get() - (INITIAL_NOTE_WIDTH / 2);
            y = (window.innerHeight / 2) - viewportY.get() - (INITIAL_NOTE_HEIGHT / 2);
            x += (Math.random() * 40 - 20);
            y += (Math.random() * 40 - 20);
        }

        const currentColumnId = columns.length > 0 ? columns[columns.length - 1].id : undefined;
        const timestamp = Date.now();
        const newNote: NoteData = {
            id: uuidv4(),
            type,
            title: '',
            content: '',
            color: defaultColor,
            rating: 0,
            icon: type === 'title' ? TITLE_ICONS[0] : undefined,
            titleSize: type === 'title' ? 'small' : undefined,
            columnId: isGridMode ? currentColumnId : undefined,
            x,
            y,
            zIndex: maxZIndex + 1,
            rotation: randomRotation,
            createdAt: timestamp,
            updatedAt: timestamp,
            order: timestamp,
        };

        const rollbackSnapshot = notesRef.current.map((note) => ({ ...note }));
        setNotes((prev) => [...prev, newNote]);
        setMaxZIndex((prev) => prev + 1);
        setActiveNote(newNote);
        setIsFabMenuOpen(false);

        if (!writableOwnerId) return;
        const ok = await persistSingleNote(newNote);
        if (!ok) {
            setNotes(rollbackSnapshot);
            setActiveNote(null);
        }
    }, [isReadOnly, spyTarget, columns, isGridMode, maxZIndex, viewportX, viewportY, writableOwnerId, persistSingleNote]);

    const updateNotePosition = useCallback((id: string, screenX: number, screenY: number) => {
        if (isGridMode || (isReadOnly && !spyTarget)) return;
        const source = notesRef.current.find((note) => note.id === id);
        if (!source) return;

        const vx = viewportX.get();
        const vy = viewportY.get();
        const x = screenX - vx;
        const y = screenY - vy;
        const columnId = dragOverColumnId || undefined;
        const updated = { ...source, x, y, columnId, updatedAt: Date.now() };
        setNotes((prev) => prev.map((note) => (note.id === id ? updated : note)));

        if (!writableOwnerId) return;
        queueNotePersist(updated, 140);
    }, [isGridMode, isReadOnly, spyTarget, dragOverColumnId, viewportX, viewportY, writableOwnerId, queueNotePersist]);

    const updateColumnPosition = useCallback((id: string, x: number, y: number) => {
        if (isGridMode || (isReadOnly && !spyTarget)) return;
        const previousColumns = [...columns];
        const updatedColumns = columns.map((column) =>
            column.id === id ? { ...column, x, y, updatedAt: Date.now() } : column
        );
        const updatedColumn = updatedColumns.find((column) => column.id === id);
        if (!updatedColumn) return;

        setColumns(updatedColumns);
        if (!writableOwnerId) return;
        void (async () => {
            const ok = await persistColumnSafe(updatedColumn);
            if (!ok) setColumns(previousColumns);
        })();
    }, [isGridMode, isReadOnly, spyTarget, columns, writableOwnerId, persistColumnSafe]);

    const updateColumnTitle = useCallback((id: string, title: string) => {
        if (viewingPartner || isReadOnly) return;
        const previousColumns = [...columns];
        const updatedColumns = columns.map((column) =>
            column.id === id ? { ...column, title, updatedAt: Date.now() } : column
        );
        const updatedColumn = updatedColumns.find((column) => column.id === id);
        if (!updatedColumn) return;

        setColumns(updatedColumns);
        if (!writableOwnerId) return;
        void (async () => {
            const ok = await persistColumnSafe(updatedColumn);
            if (!ok) setColumns(previousColumns);
        })();
    }, [viewingPartner, isReadOnly, columns, writableOwnerId, persistColumnSafe]);

    const updateColumnIcon = useCallback((id: string, icon: string) => {
        if (viewingPartner || isReadOnly) return;
        const previousColumns = [...columns];
        const updatedColumns = columns.map((column) =>
            column.id === id ? { ...column, icon, updatedAt: Date.now() } : column
        );
        const updatedColumn = updatedColumns.find((column) => column.id === id);
        if (!updatedColumn) return;

        setColumns(updatedColumns);
        if (!writableOwnerId) return;
        void (async () => {
            const ok = await persistColumnSafe(updatedColumn);
            if (!ok) setColumns(previousColumns);
        })();
    }, [viewingPartner, isReadOnly, columns, writableOwnerId, persistColumnSafe]);

    const bringToFront = useCallback(async (id: string) => {
        if (isReadOnly && !spyTarget) return;
        const source = notesRef.current.find((note) => note.id === id);
        if (!source) return;

        const newZ = maxZIndex + 1;
        const updated = { ...source, zIndex: newZ, updatedAt: Date.now() };
        const rollbackSnapshot = notesRef.current.map((note) => ({ ...note }));
        setMaxZIndex(newZ);
        setNotes((prev) => prev.map((note) => (note.id === id ? updated : note)));

        if (!writableOwnerId) return;
        const ok = await persistSingleNote(updated);
        if (!ok) setNotes(rollbackSnapshot);
    }, [maxZIndex, isReadOnly, spyTarget, writableOwnerId, persistSingleNote]);

    const bringColumnToFront = useCallback((id: string) => {
        if (viewingPartner || isReadOnly) return;
        const newZ = maxZIndex + 1;
        const previousColumns = [...columns];
        const updatedColumns = columns.map((column) =>
            column.id === id ? { ...column, zIndex: newZ, updatedAt: Date.now() } : column
        );
        const updatedColumn = updatedColumns.find((column) => column.id === id);
        if (!updatedColumn) return;

        setMaxZIndex(newZ);
        setColumns(updatedColumns);
        if (!writableOwnerId) return;
        void (async () => {
            const ok = await persistColumnSafe(updatedColumn);
            if (!ok) setColumns(previousColumns);
        })();
    }, [viewingPartner, isReadOnly, maxZIndex, columns, writableOwnerId, persistColumnSafe]);

    const saveNoteContent = useCallback(async (updatedNote: NoteData) => {
        if (isReadOnly && !spyTarget) return;
        const noteWithTimestamp = { ...updatedNote, updatedAt: Date.now() };
        const rollbackSnapshot = notesRef.current.map((note) => ({ ...note }));
        setNotes((prev) => prev.map((note) => (note.id === noteWithTimestamp.id ? noteWithTimestamp : note)));

        if (!writableOwnerId) return;
        const ok = await persistSingleNote(noteWithTimestamp);
        if (!ok) setNotes(rollbackSnapshot);
    }, [isReadOnly, spyTarget, writableOwnerId, persistSingleNote]);

    const deleteNote = useCallback(async (id: string) => {
        if (isReadOnly && !spyTarget) return;
        const rollbackSnapshot = notesRef.current.map((note) => ({ ...note }));
        setNotes((prev) => prev.filter((note) => note.id !== id));
        if (!writableOwnerId) return;
        try {
            await deleteNoteFromCloud(writableOwnerId, id);
        } catch (e) {
            console.error('Failed to delete note:', e);
            setSyncNotice('Não foi possível excluir a nota.');
            setNotes(rollbackSnapshot);
        }
    }, [isReadOnly, spyTarget, writableOwnerId]);

    const handleImport = useCallback(async (importedNotes: NoteData[]) => {
        if (isReadOnly && !spyTarget) return;
        const importTimestamp = Date.now();
        const sanitizedImport = importedNotes
            .map((rawNote, index) => {
                const sanitized = sanitizeNoteData(rawNote);
                if (sanitized.id) return sanitized;
                return { ...sanitized, id: `import-${importTimestamp}-${index}` };
            })
            .filter((note) => !!note.id);

        if (writableOwnerId) {
            try {
                await syncLocalToCloud(writableOwnerId, sanitizedImport);
            } catch (e) {
                console.error('Failed to import notes to cloud:', e);
                setSyncNotice('Não foi possível importar para a nuvem.');
            }
        } else {
            setNotes(sanitizedImport);
        }

        const zIndices = sanitizedImport.map((note) => note.zIndex);
        setMaxZIndex(zIndices.length > 0 ? Math.max(...zIndices) + 1 : 10);
    }, [isReadOnly, spyTarget, writableOwnerId]);

    const handleSendLetter = useCallback(async (message: string, sealIcon: LetterSealIcon) => {
        if (spyTarget) {
            throw new Error('cartas não estão disponíveis no modo spy.');
        }
        if (!user || userProfile?.matchStatus !== 'matched' || !userProfile.matchPartnerId) {
            throw new Error('você precisa de um match ativo para enviar cartas.');
        }

        await sendLetterToMatch(userProfile.matchPartnerId, message, sealIcon);
        playSound('/sounds/sent.mp3', notificationVolumeRef.current);
        setSyncNotice('carta enviada.');
    }, [spyTarget, user, userProfile?.matchStatus, userProfile?.matchPartnerId]);

    const handleDeleteLetter = useCallback(async (letterId: string) => {
        if (!user?.uid) {
            throw new Error('usuário não autenticado.');
        }
        await deleteLetter(user.uid, letterId);
    }, [user?.uid]);

    const handleDragOverColumn = useCallback((colId: string | null) => { if (!isReadOnly || spyTarget) setDragOverColumnId(colId); }, [isReadOnly, spyTarget]);

    const renderGridLayout = () => (
        <div className={`flex w-full items-stretch p-4 md:p-8 gap-4 ${isMobile ? 'flex-col pb-32 min-h-full h-auto' : 'flex-row overflow-auto h-full'}`}>
            <LayoutGroup>
                {/* Virtual column for notes without a columnId — mobile only */}
                {isMobile && freeCanvasNotes.length > 0 && (
                    <ColumnContainer
                        key={CANVAS_COL_ID}
                        column={canvasColVirtual}
                        notes={freeCanvasNotes.sort((a, b) => (a.order || 0) - (b.order || 0))}
                        isGridMode={true}
                        onUpdatePosition={() => { }}
                        onRemove={() => { }}
                        isReadOnly={true}
                        lang={lang}
                        isDragTarget={false}
                        onFocus={() => { }}
                        onUpdateTitle={() => { }}
                        onUpdateIcon={() => { }}
                        isDefaultColumn={false}
                        renderNote={(item) => (
                            <Note
                                key={item.id}
                                layoutId={item.id}
                                note={item}
                                onUpdatePosition={updateNotePosition}
                                onOpen={setActiveNote}
                                onFocus={bringToFront}
                                isMobile={isMobile}
                                isGridMode={true}
                                onGridDrop={handleGridDrop}
                                onDragStart={() => { setDraggingId(item.id); setDragOverColumnId(null); }}
                                onDragEnd={() => {
                                    setDraggingId(null);
                                    setDragOverColumnId(null);
                                    void flushQueuedNotePersist(item.id);
                                }}
                                onSwap={handleNoteSwap}
                                onDragOverColumn={handleDragOverColumn}
                                draggingId={draggingId}
                                stroke={currentStroke}
                                readOnly={false}
                                lang={lang}
                            />
                        )}
                    />
                )}
                {columns.map(col => {
                    const colNotes = notes
                        .filter(n => n.columnId === col.id || (!isMobile && col.id === defaultColumnId && n.columnId == null))
                        .sort((a, b) => (a.order || 0) - (b.order || 0));

                    return (
                        <ColumnContainer
                            key={col.id}
                            column={col}
                            notes={colNotes}
                            isGridMode={true}
                            onUpdatePosition={() => { }} // Not used in grid
                            onRemove={removeColumn}
                            isReadOnly={isReadOnly && !spyTarget}
                            lang={lang}
                            isDragTarget={dragOverColumnId === col.id && draggingId !== null}
                            onFocus={bringColumnToFront}
                            onUpdateTitle={updateColumnTitle}
                            onUpdateIcon={updateColumnIcon}
                            isDefaultColumn={col.id === 'default-col'}
                            renderNote={(item) => (
                                <Note
                                    key={item.id}
                                    layoutId={item.id}
                                    note={item}
                                    onUpdatePosition={updateNotePosition}
                                    onOpen={setActiveNote}
                                    onFocus={(id) => { bringToFront(id); bringColumnToFront(col.id); }}
                                    isMobile={isMobile}
                                    isGridMode={true}
                                    onGridDrop={handleGridDrop}
                                    onDragStart={() => { setDraggingId(item.id); setDragOverColumnId(item.columnId || null); }}
                                    onDragEnd={() => {
                                        setDraggingId(null);
                                        setDragOverColumnId(null);
                                        void flushQueuedNotePersist(item.id);
                                    }}
                                    onSwap={handleNoteSwap}
                                    onDragOverColumn={handleDragOverColumn}
                                    draggingId={draggingId}
                                    stroke={currentStroke}
                                    readOnly={(isReadOnly && !spyTarget)}
                                    lang={lang}
                                />
                            )}
                        />
                    );
                })}
                {(!isReadOnly || spyTarget) && (
                    <button onClick={addColumn} className={`rounded-full border border-primary/20 flex items-center justify-center text-primary/60 font-bold gap-2 transition-colors hover:bg-primary/5 lowercase shrink-0 ${isMobile ? 'w-full h-14' : 'w-[524px] h-[50px]'}`}>
                        <Plus size={18} strokeWidth={currentStroke} />
                        <span>{t.addCol}</span>
                    </button>
                )}
            </LayoutGroup>
        </div>
    );

    return (
        <div ref={containerRef} onPointerDown={!isGridMode ? handlePointerDown : undefined} onPointerMove={!isGridMode ? handlePointerMove : undefined} onPointerUp={!isGridMode ? handlePointerUp : undefined} onPointerLeave={!isGridMode ? handlePointerUp : undefined} className={`relative bg-[#f8f6f2] transition-all duration-500 select-none ${isGridMode ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`} style={{ minWidth: '100vw', minHeight: '100vh', width: '100%', height: '100%', cursor: !isGridMode ? (isPanning ? 'grabbing' : 'default') : 'default' }}>
            {/* Filtro de leitura amarelo */}
            {readingFilterIntensity > 0 && (
                <div
                    className="fixed inset-0 pointer-events-none z-[999999]"
                    style={{
                        backgroundColor: `rgba(255, 235, 150, ${readingFilterIntensity / 100})`,
                        mixBlendMode: 'multiply'
                    }}
                />
            )}
            <motion.div layoutRoot style={!isGridMode ? { x: viewportX, y: viewportY, scale: viewportScale, transformOrigin: '0 0' } : {}} className="w-full h-full relative">
                {!isGridMode && <DesktopGridPattern />}
                <main className={`w-full pt-16 relative ${isGridMode ? 'h-full' : 'h-full'}`}>
                    {isGridMode ? renderGridLayout() : (
                        <AnimatePresence>
                            {columns.map(col => {
                                const colNotes = notes
                                    .filter(n => n.columnId === col.id)
                                    .sort((a, b) => (a.order || 0) - (b.order || 0));

                                return (
                                    <ColumnContainer
                                        key={col.id}
                                        column={col}
                                        notes={colNotes}
                                        isGridMode={false}
                                        onUpdatePosition={updateColumnPosition}
                                        onRemove={removeColumn}
                                        onUpdateTitle={updateColumnTitle}
                                        onUpdateIcon={updateColumnIcon}
                                        isReadOnly={isReadOnly && !spyTarget}
                                        lang={lang}
                                        isDragTarget={dragOverColumnId === col.id && draggingId !== null}
                                        onFocus={bringColumnToFront}
                                        isDefaultColumn={col.id === 'default-col'}
                                        renderNote={(item) => (
                                            <Note
                                                key={item.id}
                                                // layoutId removido para evitar glitch de animação "voando" ao entrar na coluna
                                                note={item}
                                                onUpdatePosition={updateNotePosition}
                                                onOpen={setActiveNote}
                                                onFocus={(id) => { bringToFront(id); bringColumnToFront(col.id); }}
                                                isMobile={isMobile}
                                                isGridMode={true}
                                                onGridDrop={handleGridDrop}
                                                onDragStart={() => { setDraggingId(item.id); setDragOverColumnId(item.columnId || null); }}
                                                onDragEnd={() => {
                                                    setDraggingId(null);
                                                    setDragOverColumnId(null);
                                                    void flushQueuedNotePersist(item.id);
                                                }}
                                                onSwap={handleNoteSwap}
                                                onDragOverColumn={handleDragOverColumn}
                                                draggingId={draggingId}
                                                stroke={currentStroke}
                                                readOnly={(isReadOnly && !spyTarget)}
                                                lang={lang}
                                            />
                                        )}
                                    />
                                );
                            })}
                            {freeCanvasNotes.map((note) => (
                                <Note
                                    key={note.id}
                                    note={note}
                                    onUpdatePosition={updateNotePosition}
                                    onOpen={setActiveNote}
                                    onFocus={bringToFront}
                                    stroke={currentStroke}
                                    isMobile={isMobile}
                                    isGridMode={false}
                                    onDragStart={() => setDraggingId(note.id)}
                                    onDragEnd={() => {
                                        setDraggingId(null);
                                        setDragOverColumnId(null);
                                        void flushQueuedNotePersist(note.id);
                                    }}
                                    onDragOverColumn={handleDragOverColumn}
                                    onGridDrop={handleGridDrop}
                                    readOnly={(isReadOnly && !spyTarget)}
                                    lang={lang}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </main>
            </motion.div>

            {/* Loading Skeleton */}
            <AnimatePresence>
                {isLoadingNotes && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 flex items-center justify-center z-[9998] pointer-events-none bg-[#f8f6f2]"
                    >
                        <div className="flex gap-4 flex-wrap justify-center max-w-lg px-4">
                            <NoteSkeleton count={6} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!isLoadingNotes && notes.length === 0 && !viewingPartner && !spyTarget && (
                    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 flex items-center justify-center z-[9999] pointer-events-none bg-[#f8f6f2]">
                        <EmptyStateParticles />
                        <div className="pointer-events-auto">
                            <EmptyStateMessage onCreate={() => createItem('note')} isMobile={isMobile} stroke={currentStroke} lang={lang} />
                        </div>
                        <EmptyStateFooter lang={lang} />
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {!isGridMode && showResetView && (
                    <motion.button initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} onClick={handleResetView} className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-lg z-[40000] flex items-center gap-2 text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors border border-white/10">
                        <Target size={16} />
                        {t.centerView}
                    </motion.button>
                )}
            </AnimatePresence>


            <Header
                user={user}
                userProfile={userProfile}
                isAdmin={isAdmin}
                isMobile={isMobile}
                currentStroke={currentStroke}
                spyTarget={spyTarget}
                setSpyTarget={setSpyTarget}
                onOpenDataModal={() => setIsDataModalOpen(true)}
                onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
                lang={lang}
                readingFilterIntensity={readingFilterIntensity}
                setReadingFilterIntensity={setReadingFilterIntensity}
            />

            {/* Offline Indicator */}
            <AnimatePresence>
                {!isOnline && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-16 left-0 right-0 z-[39999] flex justify-center pointer-events-none"
                    >
                        <div className="bg-yellow-500 text-yellow-900 px-4 py-2 rounded-b-xl shadow-lg flex items-center gap-2 text-sm font-bold lowercase">
                            <WifiOff size={16} />
                            <span>{t.offline || 'sem conexão'}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {syncNotice && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[50010] bg-black/85 text-white text-xs font-bold px-4 py-2 rounded-full border border-white/10 shadow-lg lowercase"
                    >
                        {syncNotice}
                    </motion.div>
                )}
            </AnimatePresence>

            <LetterInbox
                letters={incomingLetters}
                isOnline={isOnline}
                onDelete={handleDeleteLetter}
                onNotice={setSyncNotice}
            />

            <AnimatePresence>
                {authError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-[60000] flex items-center justify-center p-4" onClick={() => setAuthError(null)}>
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
                            <div className="flex items-center gap-3 text-red-600 mb-4"><div className="bg-red-100 p-2 rounded-full"><AlertTriangle size={24} strokeWidth={currentStroke} /></div><h3 className="text-lg font-bold text-gray-800 lowercase">{authError.title}</h3></div>
                            <p className="text-gray-600 mb-4 leading-relaxed lowercase">{authError.message}</p>
                            <div className="flex justify-end"><button onClick={() => setAuthError(null)} className="px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-colors lowercase">got it</button></div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Banned User Blocking Modal */}
            <AnimatePresence>
                {userProfile?.isBanned && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-red-950 z-[70000] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center"
                        >
                            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle size={40} className="text-red-600" strokeWidth={1.5} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2 lowercase">conta suspensa</h2>
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                {userProfile.banReason || 'sua conta foi suspensa por violar os termos de uso.'}
                            </p>
                            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                                <p className="text-xs text-gray-400 mb-1 uppercase font-bold tracking-wide">conta</p>
                                <p className="text-sm text-gray-700">{user?.email}</p>
                            </div>
                            <button
                                onClick={() => logout()}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors lowercase"
                            >
                                sair
                            </button>
                            <p className="text-[10px] text-gray-400 mt-4">
                                se acredita que isso é um erro, entre em contato com o suporte.
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <FABMenu
                isOpen={isFabMenuOpen}
                setIsOpen={setIsFabMenuOpen}
                viewingPartner={viewingPartner}
                spyTarget={spyTarget}
                setSpyTarget={setSpyTarget}
                userProfile={userProfile}
                onAddColumn={addColumn}
                onCreateItem={createItem}
                onOpenLetterComposer={() => setIsLetterComposerOpen(true)}
                setViewingPartner={setViewingPartner}
                currentStroke={currentStroke}
                lang={lang}
            />
            <NoteEditor note={activeNote} isOpen={!!activeNote} onClose={() => setActiveNote(null)} onSave={saveNoteContent} onDelete={deleteNote} stroke={currentStroke} lang={lang} readOnly={isReadOnly && !spyTarget} />
            <LetterComposer
                isOpen={isLetterComposerOpen}
                partnerName={userProfile?.matchPartnerName}
                onClose={() => setIsLetterComposerOpen(false)}
                onSend={handleSendLetter}
            />
            <DataControl isOpen={isDataModalOpen} onClose={() => setIsDataModalOpen(false)} notes={notes} onImport={handleImport} user={user} onLogin={handleLogin} onLogout={logout} stroke={currentStroke} lang={lang} notificationVolume={notificationVolume} onVolumeChange={handleVolumeChange} />
            <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} user={user} notes={notes} userProfile={userProfile} onSpyUser={setSpyTarget} lang={lang} setLang={setLang} isAdmin={isAdmin} />
        </div>
    );
}

export default App;
