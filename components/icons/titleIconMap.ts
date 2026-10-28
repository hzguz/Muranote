import {
  Book,
  BookOpen,
  Bookmark,
  Circle,
  Columns2,
  Heart,
  Lightbulb,
  Notebook,
  Pencil,
  Quote,
  Search,
  Star,
  Type,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon names are persisted on notes and columns (`icon` field), so these keys are a
 * storage contract: keep them stable even when the rendered icon changes.
 */
export const TITLE_ICON_MAP: Record<string, LucideIcon> = {
  Book,
  Book2: BookOpen,
  Notebook,
  Quote,
  Star,
  Pencil,
  Bookmark,
  Typography: Type,
  Search,
  Bulb: Lightbulb,
  Heart,
  Circle,
  LayoutColumns: Columns2,
};
