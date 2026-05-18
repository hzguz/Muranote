import DOMPurify from 'dompurify';
import { NoteData } from '../types';
import { DEFAULT_TYPE_COLORS, sanitizeNoteColor } from './noteColors';

const SAFE_HTML_TAGS = ['div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u'];
const SAFE_ATTRS = ['class', 'contenteditable', 'draggable'];
const ALLOWED_GROUP_CLASSES = new Set([
  'note-group',
  'note-group-header',
  'note-group-drag-handle',
  'note-group-title',
  'note-group-actions',
  'note-group-btn',
  'note-group-delete',
  'note-group-toggle',
  'note-group-body',
  'note-group-content',
  'collapsed',
  'dragging',
]);

const DANGEROUS_TAGS = [
  'img',
  'svg',
  'path',
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
  'source',
  'picture',
  'canvas',
  'math',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'link',
  'meta',
];

const DANGEROUS_PROTOCOL = /^(?:\s*javascript:|\s*data:)/i;

const keepOnlyAllowedClasses = (html: string): string => {
  if (typeof window === 'undefined' || !window.DOMParser) {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const elements = root.querySelectorAll('*');
  elements.forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }

      if (name === 'src' || name === 'href' || name === 'xlink:href') {
        if (DANGEROUS_PROTOCOL.test(value) || !/^https?:\/\//i.test(value)) {
          el.removeAttribute(attr.name);
        }
      }
    });

    if (el.hasAttribute('class')) {
      const filtered = (el.getAttribute('class') || '')
        .split(/\s+/)
        .filter((c) => ALLOWED_GROUP_CLASSES.has(c))
        .join(' ');
      if (filtered) el.setAttribute('class', filtered);
      else el.removeAttribute('class');
    }

    if (el.hasAttribute('contenteditable')) {
      const val = (el.getAttribute('contenteditable') || '').toLowerCase();
      if (val !== 'true' && val !== 'false') {
        el.removeAttribute('contenteditable');
      }
    }

    if (el.hasAttribute('draggable')) {
      const val = (el.getAttribute('draggable') || '').toLowerCase();
      if (val !== 'true' && val !== 'false') {
        el.removeAttribute('draggable');
      }
    }
  });

  return root.innerHTML;
};

export const sanitizeNoteContent = (raw: string): string => {
  const unsafe = typeof raw === 'string' ? raw : '';
  const clean = DOMPurify.sanitize(unsafe, {
    ALLOWED_TAGS: SAFE_HTML_TAGS,
    ALLOWED_ATTR: SAFE_ATTRS,
    FORBID_TAGS: DANGEROUS_TAGS,
    FORBID_ATTR: ['srcset'],
    ALLOW_DATA_ATTR: false,
  });

  const classFiltered = keepOnlyAllowedClasses(clean);
  return classFiltered
    .replace(/<img[\s\S]*?>/gi, '')
    .replace(/data:/gi, '')
    .replace(/javascript:/gi, '');
};

export const sanitizeNoteTitle = (raw: string): string => {
  return (raw || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180);
};

export const sanitizeNoteData = (note: NoteData): NoteData => {
  return {
    ...note,
    title: sanitizeNoteTitle(note.title || ''),
    content: sanitizeNoteContent(note.content || ''),
    color: sanitizeNoteColor(note.color, DEFAULT_TYPE_COLORS[note.type]),
  };
};

export const looksLikeBlockedRichPayload = (input: string): boolean => {
  return /<\s*img|<\s*svg|<\s*script|<\s*iframe|javascript:|data:/i.test(input);
};
