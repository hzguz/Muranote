
import React, { useRef, useState, useEffect, memo } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useVelocity, PanInfo, animate } from 'framer-motion';
import { Book, Book2, Notebook, Quote, Pencil, Bookmark, Typography, Search, Bulb, Heart, Circle, Lock } from 'tabler-icons-react';
import { NoteData, Language } from '../types';
import { TITLE_SIZE_CLASSES, TITLE_ICON_SIZES, TRANSLATIONS } from '../constants';
import StarRating from './StarRating';
import { resolveNoteColors } from '../utils/noteColors';

interface NoteProps {
  note: NoteData;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onOpen: (note: NoteData) => void;
  onFocus: (id: string) => void;
  isMobile?: boolean;
  isGridMode?: boolean;
  onGridDrop?: (noteId: string, point: { x: number, y: number }, finalPos?: { x: number, y: number }, dragOffset?: { x: number, y: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onSwap?: (sourceId: string, targetId: string) => void;
  onDragOverColumn?: (columnId: string | null) => void;
  draggingId?: string | null;
  stroke: number;
  layoutId?: string;
  readOnly?: boolean;
  lang: Language;
}

const IconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; fill?: string; color?: string }>> = {
  Book, Book2, Notebook, Quote, Pencil, Bookmark, Typography, Search, Bulb, Heart, Circle
};

/**
 * Robust text extraction from HTML for preview.
 */
const getPlainText = (html: string) => {
  if (!html) return "";
  const doc = html.replace(/<[^>]*>?/gm, ' ');
  return doc.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

const Note: React.FC<NoteProps> = ({
  note,
  onUpdatePosition,
  onOpen,
  onFocus,
  isMobile = false,
  isGridMode = false,
  onGridDrop,
  onDragStart,
  onDragEnd,
  onDragOverColumn,
  draggingId,
  stroke,
  layoutId,
  readOnly = false,
  lang = 'en'
}) => {
  // Fallback seguro se a cor não existir (ex: notas antigas 'white')
  const { bg, dark, text } = resolveNoteColors(note.color);
  const t = TRANSLATIONS[lang];
  const [isDragging, setIsDragging] = useState(false);
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const lastColCheckTime = useRef(0);
  const x = useMotionValue(note.x);
  const y = useMotionValue(note.y);

  useEffect(() => {
    if (!isDragging && !isGridMode) {
      // Animação suave ao "grudar" na coluna
      animate(x, note.x, { type: 'spring', stiffness: 300, damping: 30 });
      animate(y, note.y, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [note.x, note.y, isDragging, x, y, isGridMode]);

  const xVelocity = useVelocity(x);
  const tilt = useTransform(xVelocity, [-800, 800], [-25, 25]);
  const springTilt = useSpring(tilt, { damping: 15, stiffness: 120, mass: 0.8 });
  const combinedRotation = useTransform(springTilt, (currentTilt) => isGridMode ? 0 : (note.rotation + currentTilt));

  const handleDragStart = (event: MouseEvent | TouchEvent | PointerEvent) => {
    if (readOnly) return;
    setIsDragging(true);

    // Guardar offset de onde o usuário clicou dentro da nota (para posicionamento preciso ao soltar)
    const noteEl = (event.target as HTMLElement).closest('[data-note-id]');
    if (noteEl) {
      const rect = noteEl.getBoundingClientRect();
      let clientX = 0, clientY = 0;
      if ('touches' in event && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if ('clientX' in event) {
        clientX = event.clientX;
        clientY = event.clientY;
      }
      dragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
    }

    if (onDragStart) onDragStart();
  }

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (readOnly) return;

    // Obter coordenadas do viewport a partir do evento (mais confiável que info.point)
    let clientX = info.point.x;
    let clientY = info.point.y;

    // Para touch events, usar o primeiro touch
    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // Auto-scroll no mobile quando arrastando perto das bordas
    if (isGridMode && isMobile) {
      const scrollContainer = document.querySelector('.overflow-y-auto');
      if (scrollContainer) {
        const EDGE_THRESHOLD = 80; // pixels da borda para iniciar scroll
        const SCROLL_SPEED = 8; // velocidade do scroll

        if (clientY < EDGE_THRESHOLD) {
          // Perto do topo - scrollar para cima
          scrollContainer.scrollBy({ top: -SCROLL_SPEED, behavior: 'auto' });
        } else if (clientY > window.innerHeight - EDGE_THRESHOLD) {
          // Perto do fundo - scrollar para baixo
          scrollContainer.scrollBy({ top: SCROLL_SPEED, behavior: 'auto' });
        }
      }
    }

    // Detect columns in both grid mode and free mode for consistent drop behavior
    if (onDragOverColumn) {
      const now = Date.now();
      if (now - lastColCheckTime.current > 50) { // Reduced from 100ms for better responsiveness
        const elements = document.elementsFromPoint(clientX, clientY);
        let colElement = elements.find(el => el.getAttribute('data-column-id'));

        // Fallback: se não encontrou coluna, buscar todas e verificar boundings (mobile scroll fix)
        if (!colElement) {
          const allColumnEls = document.querySelectorAll('[data-column-id]');
          allColumnEls.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right &&
              clientY >= rect.top && clientY <= rect.bottom) {
              colElement = el;
            }
          });
        }

        if (colElement) onDragOverColumn(colElement.getAttribute('data-column-id'));
        else onDragOverColumn(null);
        lastColCheckTime.current = now;
      }
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (readOnly) return;

    // Obter coordenadas do viewport a partir do evento
    let clientX = info.point.x;
    let clientY = info.point.y;

    if ('changedTouches' in event && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else if ('clientX' in event) {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // Se onGridDrop está disponível, usar para lógica unificada
    // Caso contrário, usar onUpdatePosition diretamente com motion values
    if (onGridDrop) {
      // onGridDrop recebe screen coordinates, final motion values e offset do arraste
      onGridDrop(note.id, { x: clientX, y: clientY }, { x: x.get(), y: y.get() }, dragOffsetRef.current);
    } else {
      // Fallback: usar motion values diretamente (já são coordenadas do viewport)
      onUpdatePosition(note.id, x.get(), y.get());
    }

    setIsDragging(false);
    if (onDragEnd) onDragEnd();
    if (onDragOverColumn) onDragOverColumn(null);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };
    if (!readOnly) onFocus(note.id);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    if (!clickStartRef.current) return;
    const dist = Math.sqrt(Math.pow(e.clientX - clickStartRef.current.x, 2) + Math.pow(e.clientY - clickStartRef.current.y, 2));
    if (dist < 5) onOpen(note);
    clickStartRef.current = null;
  };

  const isTitle = note.type === 'title';
  const IconComp = note.icon ? IconMap[note.icon] : Bookmark;
  const currentSizeKey = note.titleSize || 'small';
  const titleClass = isTitle ? TITLE_SIZE_CLASSES[currentSizeKey] : '';
  const iconSize = isTitle ? TITLE_ICON_SIZES[currentSizeKey] : 28;
  const foldSize = isMobile ? 20 : 26;
  const clipPathStyle = isTitle ? 'none' : `polygon(0 0, calc(100% - ${foldSize}px) 0, 100% ${foldSize}px, 100% 100%, 0 100%)`;

  const containerStyle = {
    backgroundColor: bg,
    clipPath: clipPathStyle,
    filter: readOnly ? 'saturate(0.85) contrast(0.95)' : 'none',
    willChange: 'transform'
  };

  const plainText = getPlainText(note.content);
  const previewContent = isTitle ? "" : (plainText || "...");
  const displayTitle = note.title || (isTitle ? t.newTitle : t.newNote);

  // Título sempre ocupa 2 espaços em qualquer tela no modo grid
  const gridSpanClass = isGridMode ? (isTitle ? 'col-span-full' : 'col-span-1') : '';
  const borderRadiusClass = isTitle ? 'rounded-full' : 'rounded-2xl md:rounded-3xl rounded-tr-none md:rounded-tr-none';

  // Borda mais forte para notas brancas (melhor contraste no canvas)
  const isWhite = bg.toLowerCase() === '#ffffff' || bg.toLowerCase() === '#fff';
  const borderClass = isDragging
    ? 'border-black/20 shadow-2xl'
    : isWhite
      ? 'border border-gray-300 hover:border-gray-400 active:border-gray-500 hover:shadow-lg'
      : 'border border-black/5 hover:border-black/10 active:border-black/20 hover:shadow-lg';

  return (
    <motion.div
      layoutId={layoutId}
      layout={isGridMode && !isDragging && !!draggingId ? "position" : false}
      initial={isGridMode ? { opacity: 0 } : { x: note.x, y: note.y, rotate: note.rotation }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      drag={!readOnly}
      dragListener={!readOnly}
      dragMomentum={false}
      dragElastic={isMobile ? 0 : 0.08}
      dragConstraints={isMobile ? false : undefined}
      dragSnapToOrigin={!isMobile && isGridMode ? false : undefined}
      animate={isGridMode ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.8 }}
      whileHover={!readOnly ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
      whileDrag={{
        scale: 1.1,
        zIndex: 99999,
        rotate: (isGridMode || isTitle) ? 0 : 4,
        boxShadow: "0 30px 60px -12px rgba(0, 0, 0, 0.35)",
        cursor: "grabbing"
      }}
      whileTap={(isMobile && !readOnly) ? { scale: 0.98 } : undefined}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      data-note-id={note.id}
      style={{
        zIndex: isDragging ? 99999 : note.zIndex,
        // No mobile grid mode, usar fixed durante drag para poder mover livremente
        position: isGridMode ? ((isDragging && isMobile) ? 'fixed' : 'relative') : 'absolute',
        left: isGridMode ? 'auto' : 0,
        top: isGridMode ? 'auto' : 0,
        touchAction: 'none',
        // No mobile, tornar nota transparente para detecção durante drag
        pointerEvents: (isDragging && isGridMode && isMobile) ? 'none' : 'auto',
        // In grid mode, notes fill their grid cell; in free mode, they have fixed size
        // No mobile durante drag, tamanho fixo menor
        width: isTitle ? 'auto' : (isGridMode ? ((isDragging && isMobile) ? '160px' : '100%') : '240px'),
        height: isTitle ? 'auto' : (isGridMode ? ((isDragging && isMobile) ? '160px' : 'auto') : '240px'),
        minHeight: isGridMode && !isTitle && !(isDragging && isMobile) ? '160px' : undefined,
        aspectRatio: isGridMode && !isTitle && !(isDragging && isMobile) ? '1 / 1' : 'auto',
        color: text,
        rotate: combinedRotation,
        x: isGridMode ? undefined : x,
        y: isGridMode ? undefined : y,
        cursor: readOnly ? 'pointer' : (isDragging ? 'grabbing' : 'grab'),
        ...containerStyle
      }}
      className={`group ${gridSpanClass} ${borderRadiusClass} border ${borderClass} transition-colors duration-200 select-none overflow-hidden ${isTitle ? 'whitespace-nowrap' : ''}`}
    >
      {readOnly && (
        <div className="absolute top-2 left-2 z-30 opacity-30">
          <Lock size={12} />
        </div>
      )}
      {isTitle ? (
        <div className={`flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 md:py-4 w-full h-full relative ${isMobile ? 'justify-center' : ''}`}>
          <div className="p-1.5 md:p-2 bg-black/5 rounded-full flex items-center justify-center shrink-0 relative z-20">
            {IconComp && <IconComp size={isMobile ? 18 : iconSize} strokeWidth={stroke} />}
          </div>
          <h2 className={`${isMobile ? 'text-base font-bold' : titleClass + ' font-bold'} pr-1 truncate`}>
            {displayTitle}
          </h2>
        </div>
      ) : (
        <div className="relative w-full h-full">
          <div className="absolute top-0 right-0 z-20" style={{ width: `${foldSize}px`, height: `${foldSize}px`, backgroundColor: dark, borderRadius: '0 0 0 8px' }} />
          <div className="absolute top-0 right-0 z-20 pointer-events-none opacity-20" style={{ width: `${foldSize}px`, height: `${foldSize}px`, borderRadius: '0 0 0 8px', background: 'linear-gradient(45deg, transparent 0%, #000 100%)' }} />
          <div className={`w-full p-3 md:p-7 flex flex-col overflow-hidden h-full`}>
            <h3 className="font-bold text-sm md:text-xl mb-1 md:mb-3 leading-tight pr-6 break-words line-clamp-2 opacity-90 pt-1 shrink-0">
              {displayTitle}
            </h3>

            <div className="flex-grow overflow-hidden my-1 pr-1">
              <p className="text-sm md:text-base opacity-75 whitespace-pre-wrap leading-snug break-words line-clamp-3">
                {previewContent}
              </p>
            </div>

            <div className="mt-1 md:mt-2 pt-1 md:pt-2 border-t border-black/5 flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity shrink-0">
              <StarRating rating={note.rating} readonly size={isMobile ? 10 : 12} gap="gap-0" color={text} stroke={stroke} />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default memo(Note);
