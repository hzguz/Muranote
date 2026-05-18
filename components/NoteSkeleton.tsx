import React from 'react';
import { motion } from 'framer-motion';

interface NoteSkeletonProps {
    count?: number;
    isTitle?: boolean;
}

const NoteSkeleton: React.FC<NoteSkeletonProps> = ({ count = 3, isTitle = false }) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={`
                        ${isTitle ? 'w-full h-20' : 'w-[120px] h-[120px] md:w-[140px] md:h-[140px]'}
                        rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200
                        animate-pulse
                    `}
                >
                    <div className="p-3 h-full flex flex-col justify-between">
                        {/* Title skeleton */}
                        <div className="space-y-2">
                            <div className="h-3 bg-gray-300/50 rounded w-3/4" />
                            <div className="h-2 bg-gray-300/30 rounded w-1/2" />
                        </div>

                        {/* Icon skeleton */}
                        {!isTitle && (
                            <div className="flex justify-end">
                                <div className="w-6 h-6 bg-gray-300/40 rounded-full" />
                            </div>
                        )}
                    </div>
                </motion.div>
            ))}
        </>
    );
};

export default NoteSkeleton;
