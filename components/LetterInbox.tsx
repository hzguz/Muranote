import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Feather,
  Flower2,
  Gem,
  Heart,
  Moon,
  Sparkles,
  Star,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { LetterData, LetterSealIcon } from '../types';

interface LetterInboxProps {
  letters: LetterData[];
  isOnline: boolean;
  onDelete: (letterId: string) => Promise<void>;
  onNotice: (message: string) => void;
}

const SEAL_ICONS: Record<LetterSealIcon, LucideIcon> = {
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  flower: Flower2,
  moon: Moon,
  sun: Sun,
  feather: Feather,
  gem: Gem,
};

const LetterInbox: React.FC<LetterInboxProps> = ({ letters, isOnline, onDelete, onNotice }) => {
  const [hiddenLetterIds, setHiddenLetterIds] = useState<Set<string>>(() => new Set());
  const [readingLetter, setReadingLetter] = useState<LetterData | null>(null);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const visibleLetters = useMemo(
    () =>
      letters
        .filter((l) => !hiddenLetterIds.has(l.id))
        .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()),
    [letters, hiddenLetterIds]
  );

  const nextLetter = visibleLetters[0];
  const SealIcon = nextLetter ? SEAL_ICONS[nextLetter.sealIcon] : Heart;
  const ReadingSealIcon = readingLetter ? SEAL_ICONS[readingLetter.sealIcon] : Heart;

  useEffect(() => {
    setHiddenLetterIds((current) => {
      const next = new Set(current);
      let changed = false;
      current.forEach((id) => {
        if (!letters.some((l) => l.id === id)) { next.delete(id); changed = true; }
      });
      return changed ? next : current;
    });
  }, [letters]);

  useEffect(() => () => retryTimersRef.current.forEach(clearTimeout), []);

  const deleteWithRetry = useCallback(async (letter: LetterData, attempt = 0) => {
    try {
      await onDelete(letter.id);
    } catch (error) {
      if (attempt === 0) onNotice('não foi possível apagar a carta agora. tentarei novamente.');
      if (attempt < 3) {
        const timer = setTimeout(() => void deleteWithRetry(letter, attempt + 1), 1500 * (attempt + 1));
        retryTimersRef.current.push(timer);
      } else {
        console.error('Failed to delete letter after retries:', error);
      }
    }
  }, [onDelete, onNotice]);

  const handleOpen = () => {
    if (!nextLetter) return;
    if (!isOnline) { onNotice('você precisa estar online para abrir a carta.'); return; }
    setReadingLetter(nextLetter);
  };

  const handleClose = () => {
    if (!readingLetter) return;
    const letterToDelete = readingLetter;
    setHiddenLetterIds((cur) => new Set(cur).add(letterToDelete.id));
    setReadingLetter(null);
    void deleteWithRetry(letterToDelete);
  };

  return (
    <>
      {/* Notificação no canto */}
      <AnimatePresence>
        {nextLetter && !readingLetter && (
          <motion.button
            key="corner-envelope"
            initial={{ opacity: 0, scale: 0.6, y: 32, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 32 }}
            transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            onClick={handleOpen}
            className="fixed bottom-28 left-6 z-[40000] select-none"
            aria-label="abrir carta recebida"
          >
            {/* Envelope */}
            <motion.div
              animate={{ y: [0, -5, 0], rotate: [-1, 1.5, -1] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
              className="relative"
            >
              {/* Corpo do envelope */}
              <div className="w-20 h-[52px] rounded-xl bg-[#fff4cf] border-2 border-amber-300 shadow-2xl shadow-amber-900/20 relative overflow-hidden flex flex-col">
                {/* Aba superior fechada — triângulo apontando para baixo */}
                <div
                  className="w-full bg-amber-200 border-b border-amber-300 shrink-0"
                  style={{ height: '46%', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
                />
              </div>

              {/* Selinho centralizado sobre a dobra */}
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className="absolute left-1/2 -translate-x-1/2 top-[18px] w-8 h-8 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-white z-10"
              >
                <SealIcon size={14} strokeWidth={2} />
              </motion.div>

              {/* Brilhinho superior esquerdo */}
              <motion.div
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2.0, delay: 0.6, ease: 'easeInOut' }}
                className="absolute -top-2 -left-1 text-amber-300 text-xs pointer-events-none"
              >
                ✦
              </motion.div>
              <motion.div
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2.4, delay: 1.2, ease: 'easeInOut' }}
                className="absolute -top-1 -right-2 text-amber-400 text-[10px] pointer-events-none"
              >
                ✦
              </motion.div>

              {/* Badge de quantidade */}
              {visibleLetters.length > 1 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow z-20">
                  {visibleLetters.length}
                </span>
              )}
            </motion.div>

          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal de leitura */}
      <AnimatePresence>
        {readingLetter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60000] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 [transform:translateZ(0)]"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 48, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#fffaf0] rounded-[2rem] shadow-2xl border border-amber-100 overflow-hidden"
            >
              {/* Cabeçalho */}
              <div className="p-5 border-b border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <ReadingSealIcon size={22} strokeWidth={1.6} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700/70">carta</p>
                    <h3 className="font-black text-gray-900 lowercase">mensagem recebida</h3>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-colors"
                  aria-label="fechar e apagar carta"
                >
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>

              {/* Mensagem */}
              <div className="p-6">
                <p className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm">
                  {readingLetter.message}
                </p>
              </div>

              {/* Rodapé */}
              <div className="px-6 pb-6">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleClose}
                  className="w-full py-3 rounded-2xl bg-gray-900 text-white font-black text-sm lowercase hover:bg-black transition-colors"
                >
                  fechar e apagar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LetterInbox;
