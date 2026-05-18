
import React from 'react';
import { Heart } from 'tabler-icons-react';
import { motion } from 'framer-motion';

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number, event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly?: boolean;
  size?: number;
  color?: string;
  gap?: string;
  stroke?: number;
  pulsingId?: number | null; // ID do item que deve pulsar (ex: 5)
}

const StarRating: React.FC<StarRatingProps> = ({ 
  rating, 
  onChange, 
  readonly = false, 
  size = 18,
  color = "currentColor",
  gap = "gap-1",
  stroke = 1.3,
  pulsingId = null
}) => {
  return (
    <div className={`flex ${gap}`} onMouseDown={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!readonly && onChange) onChange(value === rating ? 0 : value, e);
          }}
          className={`transition-transform flex items-center justify-center ${!readonly ? 'hover:scale-110 active:scale-90 cursor-pointer' : 'cursor-default'}`}
          disabled={readonly}
          aria-label={`Rate ${value} hearts`}
        >
          <motion.div
            animate={pulsingId === value ? { scale: [1, 1.5, 0.9, 1.2, 1] } : { scale: 1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <Heart
                size={size}
                fill={value <= rating ? color : 'transparent'}
                color={color}
                strokeWidth={stroke}
            />
          </motion.div>
        </button>
      ))}
    </div>
  );
};

export default StarRating;
