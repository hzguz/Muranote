import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'tabler-icons-react';

interface DatePickerProps {
  /** Selected date (epoch ms) or null. */
  due: number | null;
  /** Emits the new selected date on every change. */
  onChange: (due: number | null) => void;
}

const WEEKDAYS = ['s', 'm', 't', 'w', 't', 'f', 's'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const startOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const sameDay = (a: number, b: number): boolean => startOfDay(a) === startOfDay(b);

/** Returns the days to render for a month grid, padded with leading nulls. */
const buildMonthGrid = (viewYear: number, viewMonth: number): (number | null)[] => {
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewYear, viewMonth, day).getTime());
  }
  return cells;
};

const DatePicker: React.FC<DatePickerProps> = ({ due, onChange }) => {
  const anchor = due ?? Date.now();
  const [viewDate, setViewDate] = useState<Date>(new Date(anchor));

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goToMonth = (delta: number): void => {
    setViewDate(new Date(viewYear, viewMonth + delta, 1));
  };

  const handleDayClick = (dayTimestamp: number): void => {
    // Reminders are day-granular: always normalize to the start of the day.
    onChange(startOfDay(dayTimestamp));
  };

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          className="p-1.5 rounded-full hover:bg-black/5 transition-colors"
          aria-label="previous month"
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
        <span className="text-sm font-bold lowercase tracking-wide">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          className="p-1.5 rounded-full hover:bg-black/5 transition-colors"
          aria-label="next month"
        >
          <ChevronRight size={18} strokeWidth={2.2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, index) => (
          <span key={index} className="text-[10px] font-bold opacity-40 text-center lowercase py-1">
            {label}
          </span>
        ))}
        {cells.map((dayTimestamp, index) => {
          if (dayTimestamp === null) return <span key={`pad-${index}`} />;

          const selected = due !== null && sameDay(dayTimestamp, due);
          const isToday = sameDay(dayTimestamp, Date.now());

          return (
            <motion.button
              key={dayTimestamp}
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => handleDayClick(dayTimestamp)}
              className={`aspect-square rounded-xl text-xs font-bold transition-colors flex items-center justify-center ${
                selected
                  ? 'bg-black/80 text-white shadow-sm'
                  : isToday
                    ? 'ring-1 ring-black/20 hover:bg-black/5'
                    : 'hover:bg-black/5 opacity-80 hover:opacity-100'
              }`}
            >
              {new Date(dayTimestamp).getDate()}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default DatePicker;
