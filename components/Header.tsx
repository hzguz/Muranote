import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Login, User, Bulb, ShieldCheck } from 'tabler-icons-react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface HeaderProps {
    user: FirebaseUser | null;
    userProfile: UserProfile | null;
    isAdmin: boolean;
    isMobile: boolean;
    currentStroke: number;
    spyTarget: { id: string; name: string } | null;
    setSpyTarget: (target: { id: string; name: string } | null) => void;
    onOpenDataModal: () => void;
    onOpenAdminPanel: () => void;
    lang: Language;
    readingFilterIntensity: number;
    setReadingFilterIntensity: (value: number) => void;
}

const Header: React.FC<HeaderProps> = ({
    user,
    userProfile,
    isAdmin,
    isMobile,
    currentStroke,
    spyTarget,
    setSpyTarget,
    onOpenDataModal,
    onOpenAdminPanel,
    lang,
    readingFilterIntensity,
    setReadingFilterIntensity,
}) => {
    const t = TRANSLATIONS[lang];
    const [logoText, setLogoText] = React.useState("muranote");
    const [isRunningAway, setIsRunningAway] = React.useState(false);
    const [showFilterSlider, setShowFilterSlider] = React.useState(false);
    const runTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleLogoEnter = () => {
        setLogoText("schizonote");
        runTimerRef.current = setTimeout(() => {
            setIsRunningAway(true);
        }, 1000);
    };

    const handleLogoLeave = () => {
        setLogoText("muranote");
        if (runTimerRef.current) clearTimeout(runTimerRef.current);
        setIsRunningAway(false);
    };

    // Cleanup timer on unmount
    React.useEffect(() => {
        return () => {
            if (runTimerRef.current) clearTimeout(runTimerRef.current);
        };
    }, []);

    return (
        <header className="fixed top-0 left-0 right-0 h-16 shadow-sm z-[40000] flex items-center justify-between px-6 border-b pointer-events-auto transition-colors duration-300" style={{ backgroundColor: 'var(--header-bg)', borderColor: 'var(--border-color)' }}>
            <div
                className="flex items-center gap-2 md:gap-3 cursor-default"
                onMouseEnter={handleLogoEnter}
                onMouseLeave={handleLogoLeave}
            >
                <motion.span
                    className="text-white relative z-10"
                    animate={
                        isRunningAway
                            ? { x: [0, 6, -300], opacity: [1, 1, 0], rotate: [0, 15, -25], scale: [1, 0.9, 1] }
                            : { x: 0, opacity: 1, rotate: 0, scale: 1 }
                    }
                    transition={{
                        duration: isRunningAway ? 0.6 : 1.2,
                        times: isRunningAway ? [0, 0.25, 1] : undefined,
                        ease: isRunningAway ? "easeInOut" : "circOut",
                    }}
                >
                    <img src="/logo-muranote.svg" width={isMobile ? 18 : 28} height={isMobile ? 18 : 28} alt="logo" />
                </motion.span>

                <AnimatePresence mode="wait">
                    <motion.h1
                        key={logoText}
                        initial={{ opacity: 0, y: 5 }}
                        animate={
                            logoText === "schizonote"
                                ? {
                                    opacity: 1,
                                    y: 0,
                                    x: [0, -2, 2, -1, 1, 0, -3, 3, 0],
                                    rotate: [0, -1, 1, -2, 2, 0],
                                }
                                : { opacity: 1, y: 0 }
                        }
                        exit={{ opacity: 0, y: -5 }}
                        transition={
                            logoText === "schizonote"
                                ? {
                                    duration: 0.2,
                                    x: { repeat: Infinity, duration: 0.3, ease: "linear" },
                                    rotate: { repeat: Infinity, duration: 0.2, ease: "linear" },
                                }
                                : { duration: 0.2 }
                        }
                        className="text-lg md:text-xl font-bold text-white lowercase"
                    >
                        {logoText}
                    </motion.h1>
                </AnimatePresence>

                {spyTarget && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-red-600 text-white text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded-full flex items-center gap-1 md:gap-2 shadow-lg border border-red-400"
                    >
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="max-w-[80px] md:max-w-[120px] truncate">
                            {t.spyMode} {spyTarget.name}
                        </span>
                        <button onClick={() => setSpyTarget(null)} className="ml-1 hover:text-red-200">
                            <X size={12} />
                        </button>
                    </motion.div>
                )}
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
                {/* Container unificado: Modos + Filtro de leitura */}
                <div className="flex items-center gap-1 mr-2">
    
                    {/* Filtro de leitura */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilterSlider(!showFilterSlider)}
                            className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${readingFilterIntensity > 0 ? 'bg-yellow-400/30 text-yellow-300' : 'bg-black/10 text-white/60 hover:text-white/90 hover:bg-black/20'}`}
                            title={t.readingFilter}
                        >
                            <Bulb
                                size={18}
                                strokeWidth={currentStroke}
                                fill={readingFilterIntensity > 0 ? 'currentColor' : 'none'}
                            />
                        </button>
                        <AnimatePresence>
                            {showFilterSlider && (
                                <motion.div
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    className="overflow-hidden"
                                >
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={readingFilterIntensity}
                                        onChange={(e) => setReadingFilterIntensity(Number(e.target.value))}
                                        className="w-16 md:w-20 h-1.5 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                                        style={{
                                            background: `linear-gradient(to right, rgba(250, 204, 21, 0.8) 0%, rgba(250, 204, 21, 0.8) ${readingFilterIntensity * 2}%, rgba(255,255,255,0.2) ${readingFilterIntensity * 2}%, rgba(255,255,255,0.2) 100%)`
                                        }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {isAdmin && (
                    <motion.button
                        whileHover={{ scale: 1.1, backgroundColor: "#333" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onOpenAdminPanel}
                        className="p-2 md:p-2.5 bg-black text-green-400 rounded-full transition-colors flex items-center justify-center shadow-sm relative mr-1 border border-green-900"
                        title={t.adminConsole}
                    >
                        <ShieldCheck size={20} strokeWidth={currentStroke} />
                    </motion.button>
                )}

                {user ? (
                    <motion.button
                        whileHover={{ scale: 1.05, backgroundColor: "rgba(249, 250, 251, 1)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onOpenDataModal}
                        className="p-2 md:p-2.5 bg-white text-primary rounded-full transition-colors flex items-center justify-center shadow-sm relative hover:bg-gray-50"
                        title={t.myProfile}
                    >
                        {userProfile?.matchStatus === 'pending_received' && (
                            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                        )}
                        <User size={20} strokeWidth={currentStroke} />
                    </motion.button>
                ) : (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onOpenDataModal}
                        className="px-4 py-2 text-primary bg-white rounded-full font-bold text-xs md:text-sm flex items-center gap-2 shadow-sm lowercase hover:bg-gray-50 transition-colors"
                    >
                        <Login size={18} strokeWidth={currentStroke} />
                        <span className="inline leading-none pt-[1px]">{t.signIn}</span>
                    </motion.button>
                )}
            </div>
        </header>
    );
};

export default Header;
