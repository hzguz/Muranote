import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Database, Trash, Refresh, Check, Users, Tools, Eye, ChevronRight, Ban, Mail, Send } from 'tabler-icons-react';
import { User } from 'firebase/auth';
import { DocumentSnapshot } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { doc, writeBatch, updateDoc } from 'firebase/firestore';
import { db, getUsersPaginated, banUser, unbanUser, sendLetterAsAdmin } from '../services/firebase';
import type { LetterSealIcon } from '../types';
import { LETTER_SEAL_ICONS, DEFAULT_LETTER_SEAL } from '../utils/letters';
import { NoteData, UserProfile, Language } from '../types';
import { COLOR_KEYS, INITIAL_NOTE_WIDTH, INITIAL_NOTE_HEIGHT, TRANSLATIONS } from '../constants';
import Avatar from './Avatar';

interface AdminPanelProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    notes: NoteData[];
    userProfile: UserProfile | null;
    onSpyUser?: (target: { id: string, name: string }) => void;
    lang: Language;
    setLang?: (lang: Language) => void;
    isAdmin: boolean;
}

type Tab = 'tools' | 'users';

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, user, notes, onSpyUser, lang = 'en', isAdmin }) => {
    const t = TRANSLATIONS[lang];
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [activeTab, setActiveTab] = useState<Tab>('tools');

    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    const [letterTargetUid, setLetterTargetUid] = useState<string | null>(null);
    const [letterMessage, setLetterMessage] = useState('');
    const [letterSeal, setLetterSeal] = useState<LetterSealIcon>(DEFAULT_LETTER_SEAL);
    const [isSendingLetter, setIsSendingLetter] = useState(false);

    useEffect(() => {
        if (isOpen && isAdmin && activeTab === 'users' && usersList.length === 0) {
            void loadUsers();
        }
    }, [isOpen, isAdmin, activeTab, usersList.length]);

    if (!isOpen || !user || !isAdmin) return null;

    const log = (msg: string) => {
        setStatusMsg(msg);
        setTimeout(() => setStatusMsg(''), 3000);
    };

    const loadUsers = async (reset = false) => {
        setIsLoadingUsers(true);
        try {
            const result = await getUsersPaginated(reset ? null : lastDoc, 10);
            if (reset) {
                setUsersList(result.users);
            } else {
                setUsersList(prev => [...prev, ...result.users]);
            }
            setLastDoc(result.lastVisible);
        } catch (e: any) {
            log(`Erro ao carregar usuários: ${e.message || 'desconhecido'}`);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleSpy = (targetUser: UserProfile) => {
        if (onSpyUser) {
            onSpyUser({ id: targetUser.uid, name: targetUser.displayName });
            onClose();
        }
    };

    const handleBan = async (targetUser: UserProfile) => {
        const reason = prompt(`Motivo do banimento para ${targetUser.displayName}:`, 'Violação dos termos de uso');
        if (reason === null) return;

        setIsLoading(true);
        try {
            await banUser(targetUser.uid, reason);
            log(`${targetUser.displayName} foi banido.`);
            setUsersList(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, isBanned: true, banReason: reason } : u));
        } catch (e: any) {
            log(`Erro: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnban = async (targetUser: UserProfile) => {
        setIsLoading(true);
        try {
            await unbanUser(targetUser.uid);
            log(`${targetUser.displayName} foi desbanido.`);
            setUsersList(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, isBanned: false, banReason: null } : u));
        } catch (e: any) {
            log(`Erro: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendAdminLetter = async (targetUid: string) => {
        if (!letterMessage.trim()) return;
        setIsSendingLetter(true);
        try {
            await sendLetterAsAdmin(targetUid, letterMessage.trim(), letterSeal);
            log(`carta enviada para ${usersList.find(u => u.uid === targetUid)?.displayName || targetUid}.`);
            setLetterTargetUid(null);
            setLetterMessage('');
            setLetterSeal(DEFAULT_LETTER_SEAL);
        } catch (e: any) {
            log(`Erro ao enviar carta: ${e.message}`);
        } finally {
            setIsSendingLetter(false);
        }
    };

    const handleGenerateNotes = async () => {
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const timestamp = Date.now();

            for (let i = 0; i < 10; i++) {
                const id = uuidv4();
                const color = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
                const note: NoteData = {
                    id,
                    type: 'note',
                    title: `Test Auto ${i + 1}`,
                    content: 'Note automatically generated by admin panel for load testing.',
                    color,
                    rating: Math.floor(Math.random() * 6),
                    x: Math.random() * (window.innerWidth - INITIAL_NOTE_WIDTH),
                    y: Math.random() * (window.innerHeight - INITIAL_NOTE_HEIGHT),
                    zIndex: 10 + i,
                    rotation: (Math.random() * 10) - 5,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    columnId: 'default-col',
                    order: timestamp + i,
                };
                const ref = doc(db, `users/${user.uid}/notes`, id);
                batch.set(ref, note);
            }

            await batch.commit();
            log('10 notas geradas com sucesso.');
        } catch (e: any) {
            log(`Erro: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNukeNotes = async () => {
        if (!confirm('TEM CERTEZA? Isso apagará todas as notas atuais.')) return;
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            notes.forEach(n => {
                const ref = doc(db, `users/${user.uid}/notes`, n.id);
                batch.delete(ref);
            });
            await batch.commit();
            log('Todas as notas foram apagadas.');
        } catch (e: any) {
            log(`Erro: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetProfile = async () => {
        if (!confirm('Resetar status de match do perfil?')) return;
        setIsLoading(true);
        try {
            const ref = doc(db, 'users', user.uid);
            await updateDoc(ref, {
                matchStatus: 'none',
                matchPartnerId: null,
                matchPartnerName: null,
                matchPartnerPhoto: null,
                matchPartnerAvatarId: null,
                matchRequestFrom: null,
            });
            log('Perfil resetado.');
        } catch (e: any) {
            log(`Erro: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60000] flex items-center justify-center p-4 [transform:translateZ(0)]"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-700 text-gray-200 font-mono relative flex flex-col max-h-[85vh]"
                >
                    <div className="bg-black/50 p-4 border-b border-gray-700 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2 text-green-400">
                            <Shield size={20} />
                            <h2 className="text-sm font-bold uppercase tracking-widest">{t.godMode}</h2>
                        </div>
                        <button onClick={onClose} className="hover:text-white"><X size={20} /></button>
                    </div>

                    <div className="flex border-b border-gray-800 shrink-0">
                        <button
                            onClick={() => setActiveTab('tools')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'tools' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Tools size={16} /> {t.tools}
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Users size={16} /> {t.users}
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
                        {activeTab === 'tools' && (
                            <div className="space-y-4">
                                <div className="text-xs text-gray-500 mb-4 pb-4 border-b border-gray-800 flex justify-between items-center">
                                    <div>
                                        <p>ADMIN CLAIM: {user.email}</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-green-500 bg-green-900/20 px-2 py-1 rounded text-[10px] font-bold border border-green-900/30">
                                        <Check size={10} /> AUTHORIZED
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    <button onClick={handleGenerateNotes} disabled={isLoading} className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 p-3 rounded-lg border border-gray-700 transition-colors group">
                                        <div className="bg-blue-500/20 text-blue-400 p-2 rounded group-hover:bg-blue-500 group-hover:text-white transition-colors"><Database size={18} /></div>
                                        <div className="text-left"><div className="text-sm font-bold text-gray-300">{t.genNotes}</div><div className="text-[10px] text-gray-500">Stress test grid layout</div></div>
                                    </button>
                                    <button onClick={handleResetProfile} disabled={isLoading} className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 p-3 rounded-lg border border-gray-700 transition-colors group">
                                        <div className="bg-yellow-500/20 text-yellow-400 p-2 rounded group-hover:bg-yellow-500 group-hover:text-white transition-colors"><Refresh size={18} /></div>
                                        <div className="text-left"><div className="text-sm font-bold text-gray-300">{t.resetMatch}</div><div className="text-[10px] text-gray-500">Forçar status para 'none'</div></div>
                                    </button>
                                    <button onClick={handleNukeNotes} disabled={isLoading} className="flex items-center gap-3 bg-red-900/20 hover:bg-red-900/40 p-3 rounded-lg border border-red-900/50 transition-colors group">
                                        <div className="bg-red-500/20 text-red-400 p-2 rounded group-hover:bg-red-500 group-hover:text-white transition-colors"><Trash size={18} /></div>
                                        <div className="text-left"><div className="text-sm font-bold text-red-300">{t.nukeNotes}</div><div className="text-[10px] text-red-400">Limpar DB do usuário atual</div></div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase">{t.userList}</h3>
                                    <button onClick={() => loadUsers(true)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                        <Refresh size={12} /> {t.update}
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {usersList.map((u) => (
                                        <div key={u.uid} className={`rounded-lg border transition-colors ${u.isBanned ? 'bg-red-900/20 border-red-900/50' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}>
                                            <div className="p-3 flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <Avatar avatarId={u.avatarId} size="sm" className={`${u.isBanned ? 'opacity-50 grayscale' : ''}`} />
                                                        {u.isBanned && <div className="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full flex items-center justify-center"><Ban size={10} className="text-white" /></div>}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-white flex items-center gap-2">
                                                            {u.displayName}
                                                            <span className="text-[10px] font-normal text-gray-500 bg-gray-900 px-1.5 rounded">{u.matchCode}</span>
                                                            {u.isBanned && <span className="text-[10px] font-bold text-red-400 bg-red-900/50 px-1.5 rounded">BANIDO</span>}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">{u.email}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setLetterTargetUid(prev => prev === u.uid ? null : u.uid)}
                                                        className={`p-2 rounded-lg transition-colors ${letterTargetUid === u.uid ? 'bg-amber-600 text-white' : 'bg-gray-900 hover:bg-amber-600 hover:text-white text-gray-400'}`}
                                                        title="Enviar carta"
                                                    >
                                                        <Mail size={18} />
                                                    </button>
                                                    {u.isBanned ? (
                                                        <button
                                                            onClick={() => handleUnban(u)}
                                                            className="p-2 bg-green-900/30 hover:bg-green-600 hover:text-white rounded-lg text-green-400 transition-colors text-[10px] font-bold"
                                                            title="Desbanir"
                                                        >
                                                            DESBANIR
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleBan(u)}
                                                            className="p-2 bg-gray-900 hover:bg-red-600 hover:text-white rounded-lg text-gray-400 transition-colors"
                                                            title="Banir"
                                                        >
                                                            <Ban size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleSpy(u)}
                                                        className="p-2 bg-gray-900 hover:bg-blue-600 hover:text-white rounded-lg text-gray-400 transition-colors relative group-hover:scale-105"
                                                        title="Espiar Notas"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            <AnimatePresence>
                                                {letterTargetUid === u.uid && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden border-t border-gray-700"
                                                    >
                                                        <div className="p-3 space-y-3">
                                                            <textarea
                                                                value={letterMessage}
                                                                onChange={(e) => setLetterMessage(e.target.value.slice(0, 2000))}
                                                                placeholder="mensagem da carta..."
                                                                rows={3}
                                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 resize-none outline-none focus:border-amber-500 transition-colors"
                                                            />
                                                            <div className="flex gap-1 flex-wrap">
                                                                {LETTER_SEAL_ICONS.map((icon) => (
                                                                    <button
                                                                        key={icon}
                                                                        onClick={() => setLetterSeal(icon)}
                                                                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${letterSeal === icon ? 'bg-amber-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-700'}`}
                                                                    >
                                                                        {icon}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <button
                                                                onClick={() => handleSendAdminLetter(u.uid)}
                                                                disabled={!letterMessage.trim() || isSendingLetter}
                                                                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                                                            >
                                                                <Send size={14} />
                                                                {isSendingLetter ? 'enviando...' : 'enviar carta'}
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>

                                {lastDoc && (
                                    <div className="pt-4 flex justify-center">
                                        <button
                                            onClick={() => loadUsers()}
                                            disabled={isLoadingUsers}
                                            className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full border border-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isLoadingUsers ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ChevronRight size={14} />}
                                            {t.loadMore}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-auto p-4 border-t border-gray-800 bg-black/20 shrink-0">
                        <div className="h-4 flex items-center justify-center">
                            {isLoading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                            {statusMsg && <span className="text-xs text-green-400 font-bold">{statusMsg}</span>}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AdminPanel;

