import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Upload, X, AlertTriangle, Check, User as UserIcon, Logout, Heart, Copy, Link, UserPlus } from 'tabler-icons-react';
import { APP_NAME, TRANSLATIONS } from '../constants';
import { ExportData, NoteData, UserProfile, Language } from '../types';
import { User } from 'firebase/auth';
import { subscribeToUserProfile, sendMatchRequest, acceptMatchRequest, declineMatchRequest, unmatchUser, updateUserAvatar } from '../services/firebase';
import ConfirmModal from './ConfirmModal';
import Avatar from './Avatar';
import { AVATAR_OPTIONS, isAvatarId } from '../utils/avatar';

interface DataControlProps {
  isOpen: boolean;
  onClose: () => void;
  notes: NoteData[];
  onImport: (notes: NoteData[]) => void;
  user?: User | null;
  onLogin?: () => void;
  onLogout?: () => void;
  stroke: number;
  lang: Language;
  notificationVolume: number;
  onVolumeChange: (v: number) => void;
}

// Google Colored Icon Component
const GoogleIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const DataControl: React.FC<DataControlProps> = ({ isOpen, onClose, notes, onImport, user, onLogin, onLogout, stroke, lang = 'en', notificationVolume, onVolumeChange }) => {
  const t = TRANSLATIONS[lang];
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Match Logic State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [partnerCode, setPartnerCode] = useState("");
  const [isProcessingMatch, setIsProcessingMatch] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);

  useEffect(() => {
    let unsubscribe = () => { };
    if (user && isOpen) {
      unsubscribe = subscribeToUserProfile(user.uid, (profile) => {
        setUserProfile(profile);
      });
    }
    return () => unsubscribe();
  }, [user, isOpen]);

  // Helper to auto dismiss notifications
  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const triggerError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const handleCopyCode = () => {
    if (userProfile?.matchCode) {
      navigator.clipboard.writeText(userProfile.matchCode);
      triggerSuccess(t.copyCode);
    }
  };

  const handleSendMatchRequest = async () => {
    if (partnerCode.length !== 5) {
      triggerError(t.errorCode);
      return;
    }
    setIsProcessingMatch(true);
    try {
      if (user) await sendMatchRequest(user.uid, partnerCode);
      triggerSuccess(t.reqSent);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.errorConnect;
      triggerError(message);
    } finally {
      setIsProcessingMatch(false);
    }
  };

  const handleAccept = async () => {
    if (!user || !userProfile?.matchRequestFrom) return;
    setIsProcessingMatch(true);
    try {
      await acceptMatchRequest(user.uid, userProfile.matchRequestFrom);
      triggerSuccess(t.matchSuccess);
    } catch (err) {
      triggerError(t.errorAccept || "erro ao aceitar.");
    } finally {
      setIsProcessingMatch(false);
    }
  };

  const handleDecline = async () => {
    if (!user || !userProfile?.matchRequestFrom) return;
    try {
      await declineMatchRequest(user.uid, userProfile.matchRequestFrom);
    } catch (err) {
      triggerError(t.errorDecline || "erro ao recusar.");
    }
  };

  const handleUnmatch = async () => {
    if (!user || !userProfile?.matchPartnerId) return;
    setShowUnmatchConfirm(false);
    try {
      await unmatchUser(user.uid, userProfile.matchPartnerId);
      triggerSuccess(t.matchUndo);
    } catch (err) {
      triggerError(t.errorUnmatch || "erro ao desfazer.");
    }
  };

  const handleAvatarSelect = async (avatarId: string) => {
    if (!user || !isAvatarId(avatarId) || isSavingAvatar) return;
    setIsSavingAvatar(true);
    try {
      await updateUserAvatar(user.uid, avatarId);
      setUserProfile((prev) => (prev ? { ...prev, avatarId } : prev));
      triggerSuccess('avatar atualizado.');
    } catch {
      triggerError('erro ao atualizar avatar.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleExport = () => {
    try {
      const data: ExportData = {
        version: 1,
        appName: APP_NAME,
        notes: notes,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `muranote - backup - ${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerSuccess(t.backupExport);
    } catch (err) {
      triggerError("falha ao exportar.");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);

        if (!data.appName || data.appName !== APP_NAME || !Array.isArray(data.notes)) {
          throw new Error("Arquivo inválido.");
        }

        onImport(data.notes);
        triggerSuccess(t.backupRestore);
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err) {
        triggerError(t.errorFile);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="data-control-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[50000] flex items-center justify-center p-4 [transform:translateZ(0)]"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#fcfbf8] w-full max-w-lg md:max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto relative"
        >
          {/* Header */}
          <div className="p-4 bg-white border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
            <h2 className="text-lg font-bold flex items-center gap-2 lowercase text-gray-800">
              <UserIcon size={20} strokeWidth={stroke} /> {t.accessData}
            </h2>
            <button onClick={onClose} className="hover:bg-gray-100 rounded-full p-2 transition-colors text-gray-500">
              <X size={20} strokeWidth={stroke} />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* LOGIN / ACCOUNT SECTION */}
            <div>
              {user ? (
                <div className="flex flex-col gap-4">
                  {/* MATCH INTERFACE */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative min-h-[120px]">
                    {/* LOADING STATE */}
                    {!userProfile && (
                      <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                          <span className="text-[10px] text-gray-400 font-bold lowercase">{t.loadingProfile}</span>
                        </div>
                      </div>
                    )}

                    {/* STATUS BADGE */}
                    {userProfile?.matchStatus === 'matched' && (
                      <div className="bg-primary/10 text-primary text-[10px] font-bold py-1 px-3 text-center tracking-wider uppercase border-b border-primary/10">
                        {t.matchActive}
                      </div>
                    )}

                    <div className="p-6 grid grid-cols-[1fr_auto_1fr] gap-4 items-center relative">
                      {/* LEFT: SELF */}
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="relative">
                          <Avatar avatarId={userProfile?.avatarId} size="lg" className="border-2 border-primary/20 p-0.5" />
                          <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800 lowercase">{user.displayName?.split(' ')[0]}</p>
                          {userProfile && (
                            <button onClick={handleCopyCode} className="mt-1 flex items-center gap-1 text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg text-gray-500 transition-colors">
                              <span className="font-mono tracking-widest">{userProfile.matchCode}</span>
                              <Copy size={10} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* CENTER: ICON/ACTION */}
                      <div className="flex flex-col items-center justify-center z-10">
                        {userProfile?.matchStatus === 'matched' ? (
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                            <Heart fill="#ef4444" color="#ef4444" size={24} />
                          </motion.div>
                        ) : (
                          <div className="w-8 h-[1px] bg-gray-200"></div>
                        )}
                      </div>

                      {/* RIGHT: PARTNER / INPUT */}
                      <div className="flex flex-col items-center text-center gap-2 h-full justify-center">

                        {/* STATE: MATCHED */}
                        {userProfile?.matchStatus === 'matched' && (
                          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center gap-2">
                            <Avatar avatarId={userProfile.matchPartnerAvatarId} size="lg" className="border-2 border-red-200 p-0.5" />
                            <p className="text-xs font-bold text-gray-800 lowercase">{userProfile.matchPartnerName?.split(' ')[0]}</p>
                            <button onClick={() => setShowUnmatchConfirm(true)} className="text-[10px] text-red-400 hover:text-red-600 underline">desfazer</button>
                          </motion.div>
                        )}

                        {/* STATE: PENDING OUTGOING */}
                        {userProfile?.matchStatus === 'pending_sent' && (
                          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-60">
                            <div className="w-16 h-16 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center">
                              <UserPlus size={24} className="text-gray-300" />
                            </div>
                            <p className="text-[10px] text-gray-500">{t.pending}</p>
                            <button onClick={handleDecline} className="text-[10px] text-red-500 hover:text-red-700">{t.cancel}</button>
                          </div>
                        )}

                        {/* STATE: PENDING INCOMING */}
                        {userProfile?.matchStatus === 'pending_received' && (
                          <div className="flex flex-col items-center justify-center h-full gap-2 bg-yellow-50 p-2 rounded-xl border border-yellow-100 w-full">
                            <p className="text-[10px] font-bold text-yellow-700 leading-tight">{t.matchRequest}</p>
                            <div className="flex gap-2">
                              <button onClick={handleAccept} className="bg-primary text-white p-1.5 rounded-full hover:bg-primary-dark shadow-sm"><Check size={14} /></button>
                              <button onClick={handleDecline} className="bg-white text-red-400 p-1.5 rounded-full hover:bg-red-50 shadow-sm border border-red-100"><X size={14} /></button>
                            </div>
                          </div>
                        )}

                        {/* STATE: NONE */}
                        {userProfile?.matchStatus === 'none' && (
                          <div className="flex flex-col items-center gap-2 w-full">
                            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border-2 border-gray-100">
                              <Link size={24} className="text-gray-300" />
                            </div>
                            <div className="w-full">
                              <input
                                type="text"
                                placeholder={t.codePlaceholder}
                                maxLength={5}
                                value={partnerCode}
                                onChange={(e) => setPartnerCode(e.target.value.replace(/\D/g, ''))}
                                className="w-full text-center text-xs border border-gray-200 rounded-lg py-1.5 mb-1 bg-gray-50 focus:bg-white focus:ring-2 ring-primary/20 outline-none"
                              />
                              <button
                                onClick={handleSendMatchRequest}
                                disabled={isProcessingMatch}
                                className="w-full bg-gray-800 text-white text-[10px] py-1 rounded-lg font-bold hover:bg-black transition-colors disabled:opacity-50"
                              >
                                {t.connect}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {userProfile && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-3">
                      <p className="text-[10px] font-bold text-gray-500 lowercase mb-2">escolha seu avatar</p>
                      <div className="grid grid-cols-4 gap-2">
                        {AVATAR_OPTIONS.map((avatarId) => {
                          const isSelected = userProfile.avatarId === avatarId;
                          return (
                            <button
                              key={avatarId}
                              type="button"
                              onClick={() => handleAvatarSelect(avatarId)}
                              disabled={isSavingAvatar}
                              className={`rounded-xl p-1 border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                              <Avatar avatarId={avatarId} size="md" className="mx-auto" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onLogout}
                    className="w-full py-2.5 rounded-2xl border border-red-100 text-red-500 hover:bg-red-50 text-xs font-bold transition-colors flex items-center justify-center gap-2 lowercase"
                  >
                    <Logout size={16} strokeWidth={stroke} /> {t.logout}
                  </button>
                </div>
              ) : (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-primary/5 p-6 rounded-3xl border border-primary/10 flex flex-col items-center text-center gap-3 relative overflow-hidden"
                >
                  <div className="bg-white p-3 rounded-full shadow-sm mb-1 z-10">
                    <GoogleIcon size={28} />
                  </div>
                  <div className="z-10">
                    <h3 className="font-bold text-gray-800 text-lg lowercase">{t.signInGoogle}</h3>
                    <p className="text-xs text-gray-600 px-4 lowercase mt-1">{t.signInDesc}</p>
                  </div>

                  <button
                    onClick={onLogin}
                    className="w-full mt-2 flex items-center justify-center gap-3 bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-2xl shadow-sm transition-all lowercase group z-10"
                  >
                    <span className="text-sm">{t.enterNow}</span>
                  </button>
                </motion.div>
              )}
            </div>

            {/* VOLUME CONTROL */}
            <div className="flex items-center gap-3 px-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={notificationVolume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-neutral-400 w-8 text-right tabular-nums">
                {Math.round(notificationVolume * 100)}%
              </span>
            </div>

            {/* SEPARATOR */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-300 text-[10px] lowercase font-bold">{t.localBackup}</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* BACKUP ACTIONS */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-600 p-3 rounded-xl transition-all lowercase h-12"
              >
                <Download size={16} strokeWidth={stroke} />
                <span className="text-xs font-bold">{t.download}</span>
              </button>

              <label className="flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-600 p-3 rounded-xl transition-all cursor-pointer relative lowercase h-12">
                <Upload size={16} strokeWidth={stroke} />
                <span className="text-xs font-bold">{t.restore}</span>
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>
          </div>
        </motion.div>

        {/* NOTIFICATIONS - FIXED BOTTOM RIGHT */}
        <div className="fixed bottom-6 right-6 z-[60000] flex flex-col gap-2 pointer-events-none items-end">
          <AnimatePresence>
            {error && (
              <motion.div
                key="error-toast"
                initial={{ opacity: 0, x: 20, y: 0 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20, y: 0 }}
                className="bg-white text-red-600 p-3 px-4 rounded-xl text-xs font-bold flex items-center gap-2 lowercase shadow-xl border-l-4 border-red-500 pointer-events-auto"
              >
                <AlertTriangle size={18} strokeWidth={stroke} /> <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div
                key="success-toast"
                initial={{ opacity: 0, x: 20, y: 0 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20, y: 0 }}
                className="bg-white text-green-600 p-3 px-4 rounded-xl text-xs font-bold flex items-center gap-2 lowercase shadow-xl border-l-4 border-green-500 pointer-events-auto"
              >
                <Check size={18} strokeWidth={stroke} /> <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Unmatch Confirmation Modal */}
      <ConfirmModal
        key="unmatch-confirm-modal"
        isOpen={showUnmatchConfirm}
        title={t.undoMatch || "desfazer match?"}
        message={t.undoMatchConfirm}
        confirmText={t.confirm || "confirmar"}
        cancelText={t.cancel}
        onConfirm={handleUnmatch}
        onCancel={() => setShowUnmatchConfirm(false)}
        stroke={stroke}
        variant="danger"
      />
    </AnimatePresence>
  );
};

export default DataControl;

