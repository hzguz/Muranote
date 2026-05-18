import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Wand } from 'tabler-icons-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

// --- BACKGROUND PARTICLES ---
export const EmptyStateParticles: React.FC = () => {
    const particles = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: Math.random() * 5,
        duration: 10 + Math.random() * 10,
        size: 10 + Math.random() * 20
    })), []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute bottom-[-50px] text-primary/10"
                    style={{ left: p.left }}
                    animate={{
                        y: [0, -window.innerHeight - 100],
                        opacity: [0, 0.5, 0],
                        rotate: [0, Math.random() * 360]
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        ease: "linear",
                        delay: p.delay
                    }}
                >
                    <Heart size={p.size} fill="currentColor" />
                </motion.div>
            ))}
        </div>
    );
};

// --- FOOTER ---
interface EmptyStateFooterProps {
    lang: Language;
}

export const EmptyStateFooter: React.FC<EmptyStateFooterProps> = ({ lang }) => {
    const t = TRANSLATIONS[lang];
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
            className="absolute bottom-8 left-0 right-0 flex justify-center z-20 pointer-events-none"
        >
            <p className="text-primary/40 text-[12px] md:text-xs font-bold">
                {t.developedBy} <a href="" target="_blank" rel="noopener noreferrer" className="text-primary font-black hover:underline cursor-pointer pointer-events-auto">gus</a>
            </p>
        </motion.div>
    );
};

// --- MAIN EMPTY STATE MESSAGE ---
interface EmptyStateMessageProps {
    onCreate: () => void;
    isMobile: boolean;
    stroke: number;
    lang: Language;
}

export const EmptyStateMessage: React.FC<EmptyStateMessageProps> = ({ onCreate, isMobile, stroke, lang }) => {
    const t = TRANSLATIONS[lang];
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 flex flex-col items-center justify-center p-8 text-center"
        >
            {[...Array(3)].map((_, i) => (
                <motion.div
                    key={`green-heart-${i}`}
                    className="absolute text-primary/40"
                    style={{
                        top: i === 0 ? '-20%' : i === 1 ? '40%' : '110%',
                        left: i === 0 ? '10%' : i === 1 ? '-15%' : '80%',
                    }}
                    animate={{
                        y: [0, -15, 0],
                        scale: [1, 1.1, 1],
                        rotate: [0, i % 2 === 0 ? 10 : -10, 0]
                    }}
                    transition={{
                        duration: 3 + i,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.5
                    }}
                >
                    <Heart fill="currentColor" size={24 + i * 8} />
                </motion.div>
            ))}

            <motion.button
                className="bg-white/60 backdrop-blur-md p-8 md:p-12 rounded-3xl shadow-xl border border-white/50 relative overflow-hidden group cursor-pointer flex flex-col items-center gap-4 md:gap-6 pointer-events-auto"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCreate}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="bg-primary/10 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-primary relative z-10 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                    <Wand size={isMobile ? 28 : 40} strokeWidth={stroke} />
                </div>

                <div className="relative z-10 lowercase">
                    <h3 className="text-lg md:text-3xl font-bold text-primary-dark mb-1 md:mb-2">
                        {t.startJourney}
                    </h3>
                    <p className="text-gray-500 text-sm font-normal mt-1 md:mt-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                        {t.tapToCreate}
                    </p>
                </div>
            </motion.button>
        </motion.div>
    );
};

// --- DESKTOP GRID PATTERN ---
export const DesktopGridPattern: React.FC = () => (
    <div className="absolute inset-0 pointer-events-none hidden md:block overflow-visible z-0">
        <div
            className="absolute inset-[-200vw] opacity-100"
            style={{
                backgroundImage: `
          linear-gradient(to right, rgba(108, 120, 82, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(108, 120, 82, 0.05) 1px, transparent 1px)
        `,
                backgroundSize: '40px 40px',
            }}
        />
    </div>
);
