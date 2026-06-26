import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FilePlus, LayoutColumns, EyeOff, CalendarPlus } from 'tabler-icons-react';
import { MailPlus } from 'lucide-react';
import { UserProfile, NoteType, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import Avatar from './Avatar';

interface FABMenuProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    viewingPartner: boolean;
    spyTarget: { id: string; name: string } | null;
    setSpyTarget: (target: { id: string; name: string } | null) => void;
    userProfile: UserProfile | null;
    onAddColumn: () => void;
    onCreateItem: (type: NoteType) => void;
    onOpenLetterComposer: () => void;
    setViewingPartner: (viewing: boolean) => void;
    currentStroke: number;
    lang: Language;
}

const FABMenu: React.FC<FABMenuProps> = ({
    isOpen,
    setIsOpen,
    viewingPartner,
    spyTarget,
    setSpyTarget,
    userProfile,
    onAddColumn,
    onCreateItem,
    onOpenLetterComposer,
    setViewingPartner,
    currentStroke,
    lang,
}) => {
    const t = TRANSLATIONS[lang];

    return (
        <>
            {/* FAB Menu Options */}
            <AnimatePresence>
                {isOpen && !viewingPartner && !spyTarget && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.8 }}
                        className="fixed bottom-28 right-8 flex flex-col gap-3 z-[40000] items-end lowercase"
                    >
                        <button
                            onClick={onAddColumn}
                            className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors group"
                        >
                            <span className="font-bold text-primary opacity-80 group-hover:opacity-100">
                                {t.addCol}
                            </span>
                            <div className="bg-primary/10 p-2 rounded-full text-primary">
                                <LayoutColumns size={20} strokeWidth={currentStroke} />
                            </div>
                        </button>
                        <button
                            onClick={() => onCreateItem('reminder')}
                            className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors group"
                        >
                            <span className="font-bold text-primary opacity-80 group-hover:opacity-100">
                                {t.addReminder}
                            </span>
                            <div className="bg-primary/10 p-2 rounded-full text-primary">
                                <CalendarPlus size={20} strokeWidth={currentStroke} />
                            </div>
                        </button>
                        <button
                            onClick={() => onCreateItem('note')}
                            className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors group"
                        >
                            <span className="font-bold text-primary opacity-80 group-hover:opacity-100">
                                {t.addNote}
                            </span>
                            <div className="bg-primary/10 p-2 rounded-full text-primary">
                                <FilePlus size={20} strokeWidth={currentStroke} />
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Exit Spy Mode Button */}
            <AnimatePresence>
                {spyTarget && (
                    <motion.button
                        initial={{ scale: 0, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0, y: 20 }}
                        onClick={() => setSpyTarget(null)}
                        className="fixed bottom-8 left-8 bg-black text-white px-6 py-3 rounded-full shadow-2xl z-[40000] flex items-center gap-2 font-bold text-xs uppercase tracking-widest border border-gray-700 hover:bg-gray-900"
                    >
                        <EyeOff size={16} /> {t.exitSpy}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Partner View Toggle Button */}
            <AnimatePresence>
                {userProfile?.matchStatus === 'matched' && !spyTarget && (
                    <motion.button
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setViewingPartner(!viewingPartner)}
                        className={`fixed bottom-8 left-8 w-16 h-16 rounded-full shadow-lg transition-colors flex items-center justify-center z-[40000] overflow-hidden border-4 ${viewingPartner ? 'border-red-400' : 'border-primary'
                            }`}
                    >
                        <Avatar
                            avatarId={viewingPartner ? userProfile.matchPartnerAvatarId : userProfile.avatarId}
                            size="lg"
                            className="w-full h-full rounded-none"
                        />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Send Letter Button */}
            <AnimatePresence>
                {userProfile?.matchStatus === 'matched' && !spyTarget && (
                    <motion.button
                        initial={{ scale: 0, rotate: -14 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 14 }}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={onOpenLetterComposer}
                        className="fixed bottom-8 left-28 w-14 h-14 rounded-full shadow-lg transition-colors flex items-center justify-center z-[40000] border-4 border-amber-200 bg-[#fff4cf] text-amber-900 hover:bg-amber-100"
                        aria-label="send letter"
                    >
                        <MailPlus size={25} strokeWidth={1.8} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Main FAB Button */}
            {(!viewingPartner || spyTarget) && (
                <motion.button
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: isOpen ? 45 : 0 }}
                    exit={{ scale: 0, rotate: -180 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-lg shadow-primary/30 transition-colors flex items-center justify-center z-[40000] ${isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-dark'
                        } text-white`}
                    aria-label="new note"
                >
                    <Plus size={32} strokeWidth={2} />
                </motion.button>
            )}
        </>
    );
};

export default FABMenu;
