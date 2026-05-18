import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Plus, Pencil, Lock, Book, Book2, Notebook, Quote, Bookmark, Typography, Search, Bulb, Heart, LayoutColumns, Star } from 'tabler-icons-react';
import { Grid2x2, Grid3x3 } from 'lucide-react';
import { ColumnData, NoteData, Language } from '../types';
import { TRANSLATIONS, TITLE_ICONS } from '../constants';

// Icon map for dynamic rendering
const IconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
    Book, Book2, Notebook, Quote, Star, Pencil, Bookmark, Typography, Search, Bulb, Heart, LayoutColumns
};

interface ColumnContainerProps {
    column: ColumnData;
    notes: NoteData[];
    isGridMode: boolean;
    onUpdatePosition: (id: string, x: number, y: number) => void;
    onRemove: (id: string) => void;
    onUpdateTitle?: (id: string, title: string) => void;
    onUpdateIcon?: (id: string, icon: string) => void;
    renderNote: (note: NoteData) => React.ReactNode;
    isReadOnly?: boolean;
    lang: Language;
    isDragTarget?: boolean;
    onFocus?: (id: string) => void;
    isDefaultColumn?: boolean;
    canvasScale?: number;
}

const ColumnContainer: React.FC<ColumnContainerProps> = ({
    column,
    notes,
    isGridMode,
    onUpdatePosition,
    onRemove,
    onUpdateTitle,
    onUpdateIcon,
    renderNote,
    isReadOnly,
    lang,
    isDragTarget = false,
    onFocus,
    isDefaultColumn = false,
    canvasScale = 1
}) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isPickingIcon, setIsPickingIcon] = useState(false);
    const [tempTitle, setTempTitle] = useState(column.title);
    const [gridCols, setGridCols] = useState<2 | 3>(2);
    const iconPickerRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
    const t = TRANSLATIONS[lang];

    // Close icon picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
                setIsPickingIcon(false);
            }
        };
        if (isPickingIcon) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPickingIcon]);

    // Get the current icon component
    const CurrentIcon = column.icon ? IconMap[column.icon] : LayoutColumns;

    const x = useMotionValue(column.x);
    const y = useMotionValue(column.y);

    useEffect(() => {
        x.set(column.x);
        y.set(column.y);
    }, [column.x, column.y, x, y]);


    const handleTitleBlur = () => {
        setIsEditingTitle(false);
        if (onUpdateTitle) onUpdateTitle(column.id, tempTitle);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleTitleBlur();
    };

    if (isGridMode) {
        return (
            <motion.div
                data-column-id={column.id}
                className={`shadow-none rounded-3xl border flex flex-col relative w-full md:w-[524px] shrink-0 min-h-[300px] md:min-h-[500px] h-full bg-white/90 transition-all duration-200 border-primary/10`}
            >
                {!isReadOnly && (
                    isDefaultColumn ? (
                        <div
                            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/5 text-black/30"
                            title={t.mainColumn}
                        >
                            <Lock size={14} />
                        </div>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onRemove(column.id)}
                            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/5 hover:bg-red-100 hover:text-red-500 text-black/40 cursor-pointer transition-colors"
                        >
                            <X size={14} />
                        </motion.button>
                    )
                )}
                <div className="w-full px-4 pt-4 pb-3 group/title">
                    <div className="flex items-center gap-3">
                        {/* Icon Button */}
                        <div className="relative" ref={iconPickerRef}>
                            <button
                                onClick={() => !isReadOnly && setIsPickingIcon(!isPickingIcon)}
                                className={`p-2 rounded-xl bg-primary/10 text-primary transition-all ${!isReadOnly ? 'hover:bg-primary/20 cursor-pointer' : ''}`}
                            >
                                <CurrentIcon size={18} strokeWidth={1.5} />
                            </button>

                            {/* Icon Picker Dropdown */}
                            <AnimatePresence>
                                {isPickingIcon && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                        className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-[9999]"
                                        style={{ minWidth: '200px' }}
                                    >
                                        <div className="grid grid-cols-5 gap-2">
                                            {TITLE_ICONS.map((iconName) => {
                                                const Icon = IconMap[iconName];
                                                return (
                                                    <button
                                                        key={iconName}
                                                        onClick={() => {
                                                            if (onUpdateIcon) onUpdateIcon(column.id, iconName);
                                                            setIsPickingIcon(false);
                                                        }}
                                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${column.icon === iconName ? 'bg-primary/20 text-primary' : 'hover:bg-gray-100 text-gray-600'}`}
                                                    >
                                                        {Icon && <Icon size={18} strokeWidth={1.5} />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Title */}
                        {isEditingTitle ? (
                            <input
                                autoFocus
                                className="bg-transparent border-b border-primary/20 outline-none font-bold text-primary-dark lowercase max-w-[200px]"
                                value={tempTitle}
                                onChange={(e) => setTempTitle(e.target.value)}
                                onBlur={handleTitleBlur}
                                onKeyDown={handleTitleKeyDown}
                            />
                        ) : (
                            <h2
                                onClick={() => !isReadOnly && setIsEditingTitle(true)}
                                className="font-bold text-primary-dark lowercase cursor-text select-none truncate max-w-[200px] hover:bg-black/5 rounded px-1 transition-colors"
                            >
                                {column.title}
                            </h2>
                        )}
                    </div>
                </div>
                <div className="w-full px-4 flex-grow flex flex-col pb-4">
                    <div data-column-id={column.id} className={`grid grid-cols-2 gap-3 relative w-full flex-grow content-start pb-4 p-3 border rounded-2xl transition-colors duration-200 ${isDragTarget ? 'border-[#a8b5a0]/50 bg-[#e8ece6]/50' : 'border-primary/10 bg-white/50'}`}>
                        <AnimatePresence mode="sync">
                            {notes.map(renderNote)}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Modo Livre
    return (
        <motion.div
            drag={!isReadOnly}
            dragMomentum={false}
            dragElastic={0}
            onDragStart={(_event, info: PanInfo) => {
                dragStartRef.current = { pointerX: info.point.x, pointerY: info.point.y, x: x.get(), y: y.get() };
                if (onFocus) onFocus(column.id);
            }}
            onDrag={(_event, info: PanInfo) => {
                if (!dragStartRef.current) return;
                const scale = Math.max(canvasScale, 0.001);
                x.set(dragStartRef.current.x + (info.point.x - dragStartRef.current.pointerX) / scale);
                y.set(dragStartRef.current.y + (info.point.y - dragStartRef.current.pointerY) / scale);
            }}
            onDragEnd={(_event, info: PanInfo) => {
                if (dragStartRef.current) {
                    const scale = Math.max(canvasScale, 0.001);
                    x.set(dragStartRef.current.x + (info.point.x - dragStartRef.current.pointerX) / scale);
                    y.set(dragStartRef.current.y + (info.point.y - dragStartRef.current.pointerY) / scale);
                }
                dragStartRef.current = null;
                onUpdatePosition(column.id, x.get(), y.get());
            }}
            onPointerDown={() => {
                if (onFocus) onFocus(column.id);
            }}
            style={{
                position: 'absolute',
                x,
                y,
                zIndex: column.zIndex || 1,
                touchAction: 'none',
            }}
            className={`bg-white/95 rounded-3xl border p-4 shadow-lg cursor-grab active:cursor-grabbing active:shadow-2xl transition-shadow border-primary/10`}
        >
            <div className="flex justify-between items-center mb-3 px-1 group/title">
                <div className="flex items-center gap-3 flex-grow">
                    {/* Icon Button */}
                    <div className="relative" ref={iconPickerRef}>
                        <button
                            onClick={() => !isReadOnly && setIsPickingIcon(!isPickingIcon)}
                            className={`p-2 rounded-xl bg-primary/10 text-primary transition-all ${!isReadOnly ? 'hover:bg-primary/20 cursor-pointer' : ''}`}
                        >
                            <CurrentIcon size={18} strokeWidth={1.5} />
                        </button>

                        {/* Icon Picker Dropdown */}
                        <AnimatePresence>
                            {isPickingIcon && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                    className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-[9999]"
                                    style={{ minWidth: '200px' }}
                                >
                                    <div className="grid grid-cols-5 gap-2">
                                        {TITLE_ICONS.map((iconName) => {
                                            const Icon = IconMap[iconName];
                                            return (
                                                <button
                                                    key={iconName}
                                                    onClick={() => {
                                                        if (onUpdateIcon) onUpdateIcon(column.id, iconName);
                                                        setIsPickingIcon(false);
                                                    }}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${column.icon === iconName ? 'bg-primary/20 text-primary' : 'hover:bg-gray-100 text-gray-600'}`}
                                                >
                                                    {Icon && <Icon size={18} strokeWidth={1.5} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Title */}
                    {isEditingTitle ? (
                        <input
                            autoFocus
                            className="bg-transparent border-b border-primary/30 outline-none flex-grow font-bold text-base text-primary-dark lowercase"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            onKeyDown={handleTitleKeyDown}
                        />
                    ) : (
                        <h2
                            onClick={() => !isReadOnly && setIsEditingTitle(true)}
                            className="font-bold text-base text-primary-dark lowercase cursor-text select-none tracking-tight hover:bg-black/5 rounded px-1 transition-colors"
                        >
                            {column.title}
                        </h2>
                    )}
                </div>

                <div className="flex items-center gap-1 ml-2">
                    {/* Grid cols toggle */}
                    <button
                        onClick={() => setGridCols(c => c === 2 ? 3 : 2)}
                        className="p-1.5 rounded-full bg-black/5 text-black/30 hover:bg-black/10 hover:text-black/60 transition-colors"
                        title={gridCols === 2 ? '3×3' : '2×2'}
                    >
                        {gridCols === 2 ? <Grid2x2 size={14} /> : <Grid3x3 size={14} />}
                    </button>

                    {/* Lock/Delete Button */}
                    {!isReadOnly && (
                        isDefaultColumn ? (
                            <div className="p-1.5 rounded-full bg-black/5 text-black/30" title={t.mainColumn}>
                                <Lock size={14} />
                            </div>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.1, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onRemove(column.id)}
                                className="p-1.5 rounded-full bg-black/5 text-black/30 hover:text-red-500 transition-colors"
                            >
                                <X size={14} />
                            </motion.button>
                        )
                    )}
                </div>
            </div>

            <div
                data-column-id={column.id}
                className={`relative border rounded-2xl bg-white/40 transition-colors duration-200 ${isDragTarget ? 'border-[#a8b5a0]/50 bg-[#e8ece6]/40' : 'border-primary/10'}`}
                style={{
                    width: gridCols === 2 ? '520px' : '760px',
                    minHeight: '520px'
                }}
            >
                {notes.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-2"
                            >
                                <Plus size={18} className="text-primary/20" />
                            </motion.div>
                            <span className="text-primary/30 text-xs font-medium lowercase">{t.dragNotesHere || "drag notes here"}</span>
                        </div>
                    </div>
                ) : (
                    <div className={`grid gap-4 p-3 ${gridCols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        <AnimatePresence mode="sync">
                            {notes.map(renderNote)}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default ColumnContainer;
