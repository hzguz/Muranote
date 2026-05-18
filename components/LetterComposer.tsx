import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Feather,
  Flower2,
  Gem,
  Heart,
  Mail,
  Moon,
  Send,
  Sparkles,
  Star,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { LetterSealIcon } from '../types';
import { DEFAULT_LETTER_SEAL, LETTER_MAX_MESSAGE_LENGTH, LETTER_SEAL_ICONS } from '../utils/letters';

interface LetterComposerProps {
  isOpen: boolean;
  partnerName?: string | null;
  onClose: () => void;
  onSend: (message: string, sealIcon: LetterSealIcon) => Promise<void>;
}

const sealIcons: Record<LetterSealIcon, LucideIcon> = {
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  flower: Flower2,
  moon: Moon,
  sun: Sun,
  feather: Feather,
  gem: Gem,
};

const LetterComposer: React.FC<LetterComposerProps> = ({ isOpen, partnerName, onClose, onSend }) => {
  const [message, setMessage] = useState('');
  const [sealIcon, setSealIcon] = useState<LetterSealIcon>(DEFAULT_LETTER_SEAL);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = LETTER_MAX_MESSAGE_LENGTH - message.length;
  const cleanMessage = useMemo(() => message.trim(), [message]);

  useEffect(() => {
    if (!isOpen) {
      setMessage('');
      setSealIcon(DEFAULT_LETTER_SEAL);
      setError(null);
      setIsSending(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cleanMessage || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      await onSend(cleanMessage, sealIcon);
      onClose();
    } catch (sendError: unknown) {
      const errorMessage = sendError instanceof Error ? sendError.message : 'não foi possível enviar a carta.';
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 [transform:translateZ(0)]"
          onClick={() => !isSending && onClose()}
        >
          <motion.form
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-[#fffaf0] rounded-[2rem] shadow-2xl border border-amber-100 overflow-hidden"
          >
            <div className="p-5 border-b border-amber-100 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-inner">
                  <Mail size={24} strokeWidth={1.6} />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 lowercase">nova carta</h2>
                  <p className="text-xs text-gray-500 lowercase">
                    para {partnerName?.split(' ')[0] || 'seu match'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors disabled:opacity-50"
                aria-label="fechar"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-amber-700/70 mb-2">
                  mensagem
                </span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, LETTER_MAX_MESSAGE_LENGTH))}
                  placeholder="escreva algo que mereça um envelope..."
                  className="w-full h-40 resize-none rounded-3xl border border-amber-100 bg-white/80 px-4 py-4 text-sm text-gray-800 outline-none focus:ring-4 focus:ring-amber-200/60 focus:border-amber-300 transition-all shadow-inner"
                />
                <div className="mt-2 flex items-center justify-between text-[10px] font-bold lowercase">
                  <span className={error ? 'text-red-500' : 'text-gray-400'}>{error || 'será apagada após a leitura.'}</span>
                  <span className={remaining < 80 ? 'text-red-400' : 'text-gray-400'}>{remaining}</span>
                </div>
              </label>

              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-amber-700/70 mb-3">
                  selo
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {LETTER_SEAL_ICONS.map((iconName) => {
                    const Icon = sealIcons[iconName];
                    const selected = sealIcon === iconName;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setSealIcon(iconName)}
                        className={`h-12 rounded-2xl border flex items-center justify-center transition-all ${
                          selected
                            ? 'bg-amber-200 border-amber-300 text-amber-900 shadow-sm scale-[1.02]'
                            : 'bg-white/80 border-amber-100 text-gray-400 hover:text-amber-700 hover:border-amber-200'
                        }`}
                        aria-label={`selo ${iconName}`}
                      >
                        <Icon size={21} strokeWidth={1.7} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-5 pt-0 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="flex-1 py-3 rounded-2xl border border-amber-100 bg-white/70 text-gray-500 font-black text-sm lowercase hover:bg-white transition-colors disabled:opacity-50"
              >
                cancelar
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={!cleanMessage || isSending}
                className="flex-1 py-3 rounded-2xl bg-gray-900 text-white font-black text-sm lowercase hover:bg-black transition-colors disabled:opacity-40 disabled:hover:bg-gray-900 flex items-center justify-center gap-2"
              >
                <Send size={16} strokeWidth={1.8} />
                {isSending ? 'enviando...' : 'enviar'}
              </motion.button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LetterComposer;
