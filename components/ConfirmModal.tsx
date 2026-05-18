import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'tabler-icons-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    stroke?: number;
    variant?: 'danger' | 'warning' | 'default';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'confirmar',
    cancelText = 'cancelar',
    onConfirm,
    onCancel,
    stroke = 1.5,
    variant = 'danger'
}) => {
    const variantStyles = {
        danger: {
            icon: 'text-red-500',
            iconBg: 'bg-red-50',
            confirm: 'bg-red-500 hover:bg-red-600 text-white'
        },
        warning: {
            icon: 'text-yellow-500',
            iconBg: 'bg-yellow-50',
            confirm: 'bg-yellow-500 hover:bg-yellow-600 text-white'
        },
        default: {
            icon: 'text-primary',
            iconBg: 'bg-primary/10',
            confirm: 'bg-primary hover:bg-primary-dark text-white'
        }
    };

    const styles = variantStyles[variant];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onCancel}
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60000] flex items-center justify-center p-4 [transform:translateZ(0)]"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-5 pb-0 flex items-start gap-4">
                            <div className={`p-3 rounded-full ${styles.iconBg}`}>
                                <AlertTriangle size={24} strokeWidth={stroke} className={styles.icon} />
                            </div>
                            <div className="flex-1 pt-1">
                                <h3 className="text-lg font-bold text-gray-900 lowercase">{title}</h3>
                                <p className="text-sm text-gray-500 mt-1 lowercase">{message}</p>
                            </div>
                            <button
                                onClick={onCancel}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                            >
                                <X size={18} strokeWidth={stroke} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="p-5 pt-6 flex gap-3">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm lowercase hover:bg-gray-50 transition-colors"
                            >
                                {cancelText}
                            </button>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={onConfirm}
                                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm lowercase transition-colors ${styles.confirm}`}
                            >
                                {confirmText}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmModal;
