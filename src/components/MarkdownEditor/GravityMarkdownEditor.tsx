import { useEffect, useCallback, useImperativeHandle, forwardRef, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import React from 'react';
import i18next from 'i18next';
import {
  useMarkdownEditor,
  MarkdownEditorView,
  ToolbarDataType,
} from '@gravity-ui/markdown-editor';
// @ts-ignore
import { full as defaultPreset } from '@gravity-ui/markdown-editor/_/modules/toolbars/presets.js';
import { useQuery } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import { useCollections } from '@/hooks/useCollections';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Media } from '@/types';
import { Filmstrip } from '@gravity-ui/icons';

export interface GravityMarkdownEditorHandle {
  setContent: (markup: string) => void;
}

interface GravityMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  autofocus?: boolean;
}

type InsertPos =
  | { type: 'wysiwyg'; pos: number }
  | { type: 'markup'; pos: number };

/* Helper to find a link mark under the current ProseMirror selection */
const findLinkMark = (state: any) => {
  const { $from, to } = state.selection;
  const linkType = state.schema.marks.link;
  if (!linkType) return null;

  let linkMark = null;
  // Check stored/active marks first
  const activeMarks = state.storedMarks || $from.marks();
  linkMark = activeMarks.find((m: any) => m.type === linkType);
  if (linkMark) return linkMark;

  // Search within selection range
  state.doc.nodesBetween($from.pos, to, (node: any) => {
    const found = node.marks.find((m: any) => m.type === linkType);
    if (found) {
      linkMark = found;
      return false; // stop traversal
    }
  });
  return linkMark;
};

/* ================================================================== */
/*  Mention Search Modal                                               */
/* ================================================================== */
const MentionSearchModal: React.FC<{
  position: { top: number; left: number };
  collections: any[];
  onSelect: (media: Media) => void;
  onClose: () => void;
}> = ({ position, collections, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['media', 'mention-modal', query],
    queryFn: () => tauriApi.media.getAll({ searchQuery: query, limit: 8 }),
  });

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { setActiveIndex(0); }, [suggestions.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[activeIndex]) onSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const MODAL_WIDTH = 320;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const left = Math.min(Math.max(8, position.left), vw - MODAL_WIDTH - 8);

  // Open upward if cursor is in the bottom half of the screen
  const openUpward = position.top > vh / 2;
  const top = openUpward ? position.top - 4 : position.top + 4;
  const transformStr = openUpward ? 'translateY(-100%)' : 'none';

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998]" onMouseDown={onClose} />

      <div
        className="fixed z-[9999] bg-[#0d0f1a]/98 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-xl overflow-hidden"
        style={{
          top,
          left,
          width: MODAL_WIDTH,
          transform: transformStr,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="px-3 py-2.5 border-b border-white/5 flex items-center gap-2.5">
          <svg className="w-3.5 h-3.5 text-white/25 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={i18next.t('mediaCreate.linkMediaPlaceholder')}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/25"
          />
          <kbd className="text-[9px] text-white/20 border border-white/10 rounded px-1 py-0.5 font-mono">{i18next.t('mediaCreate.escapeKey')}</kbd>
        </div>

        {/* Results list */}
        <div className="p-1.5 max-h-[300px] overflow-y-auto flex flex-col gap-0.5">
          {suggestions.length === 0 ? (
            <p className="px-3 py-5 text-[11px] text-white/30 text-center">
              {query ? i18next.t('mediaCreate.noMediaFound') : i18next.t('mediaCreate.typeToSearch')}
            </p>
          ) : (
            suggestions.map((media, idx) => {
              const coll = collections?.find(c => c.id === media.collection_id);
              const collColor = coll?.color || '#22d3ee';
              const coverUrl = media.cover_image
                ? `${convertFileSrc(media.cover_image)}?t=${media.updated_at}`
                : null;
              return (
                <div
                  key={media.id}
                  onMouseDown={e => { e.preventDefault(); onSelect(media); }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    idx === activeIndex
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-[30px] h-[40px] rounded overflow-hidden shrink-0 bg-white/5 border border-white/5 flex items-center justify-center">
                    {coverUrl ? (
                      <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] text-white/20 font-bold">—</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate leading-tight">{media.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {coll && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: collColor }}>
                          {coll.name}
                        </span>
                      )}
                      {media.user_rating && (
                        <span className="text-[9px] px-1 rounded bg-white/5 text-white/40 font-mono">
                          ★ {media.user_rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="px-3 py-1.5 border-t border-white/5 flex items-center gap-3 text-[9px] text-white/20">
          <span>↑↓ naviguer</span>
          <span>↵ sélectionner</span>
          <span>Échap annuler</span>
        </div>
      </div>
    </>,
    document.body
  );
};

/* ================================================================== */
/*  Main Editor                                                        */
/* ================================================================== */
const GravityMarkdownEditor = forwardRef<GravityMarkdownEditorHandle, GravityMarkdownEditorProps>(
  ({ value, onChange, autofocus = false }, ref) => {
    const editor = useMarkdownEditor({
      initial: { markup: value },
    });

    const [mentionModalOpen, setMentionModalOpen] = useState(false);
    const [mentionInsertPos, setMentionInsertPos] = useState<InsertPos | null>(null);
    const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const { data: collections = [] } = useCollections();

    // Expose setContent to parent
    useImperativeHandle(ref, () => ({
      setContent: (markup: string) => { editor.replace(markup); },
    }), [editor]);

    // Sync changes to parent
    const handleChange = useCallback(() => {
      onChange(editor.getValue());
    }, [editor, onChange]);

    useEffect(() => {
      editor.on('change', handleChange);
      return () => { editor.off('change', handleChange); };
    }, [editor, handleChange]);

    // Function to trigger opening the media search modal at current cursor position
    const triggerMediaModal = useCallback(() => {
      /* --- WYSIWYG (ProseMirror) --- */
      if (editor.currentMode === 'wysiwyg') {
        const view = (editor as any)._wysiwygView;
        if (view) {
          const { state } = view;
          const $from = state.selection.$from;
          try {
            const coords = view.coordsAtPos($from.pos);
            setMentionInsertPos({ type: 'wysiwyg', pos: $from.pos });
            setModalPosition({ top: coords.bottom, left: coords.left });
            setMentionModalOpen(true);
          } catch {
            const rect = containerRef.current?.getBoundingClientRect();
            setMentionInsertPos({ type: 'wysiwyg', pos: $from.pos });
            setModalPosition({
              top: (rect?.top ?? 100) + 60,
              left: (rect?.left ?? 100) + 120,
            });
            setMentionModalOpen(true);
          }
        }
      }

      /* --- Markup (CodeMirror) --- */
      else if (editor.currentMode === 'markup') {
        const cm = (editor as any).markupEditor?.cm;
        if (cm) {
          const { state } = cm;
          const sel = state.selection.main;
          try {
            const coords = cm.coordsAtPos(sel.from, 1);
            if (coords) {
              setMentionInsertPos({ type: 'markup', pos: sel.from });
              setModalPosition({ top: coords.bottom, left: coords.left });
              setMentionModalOpen(true);
            } else {
              throw new Error();
            }
          } catch {
            const rect = containerRef.current?.getBoundingClientRect();
            setMentionInsertPos({ type: 'markup', pos: sel.from });
            setModalPosition({
              top: (rect?.top ?? 100) + 60,
              left: (rect?.left ?? 100) + 120,
            });
            setMentionModalOpen(true);
          }
        }
      }
    }, [editor]);

    // Intercept mouse clicks on media mentions in capture phase to prevent standard link bubble/edit popups from opening
    useEffect(() => {
      const handleContainerClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        if (link) {
          const href = link.getAttribute('href');
          if (href && href.startsWith('media:')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      };

      const container = containerRef.current;
      if (container) {
        container.addEventListener('click', handleContainerClick, true);
      }
      return () => {
        if (container) {
          container.removeEventListener('click', handleContainerClick, true);
        }
      };
    }, []);

    // Keyboard shortcut handler for Ctrl+M (or Cmd+M)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
          if (containerRef.current?.contains(document.activeElement)) {
            e.preventDefault();
            triggerMediaModal();
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [triggerMediaModal]);

    // Custom toolbar preset extending the default one to add the "Média" button
    const customPreset = useMemo(() => {
      const items = {
        ...defaultPreset.items,
        // Override standard link to NOT highlight if we are inside a media link
        link: {
          ...defaultPreset.items.link,
          wysiwyg: {
            ...defaultPreset.items.link.wysiwyg,
            isActive: (editorInstance: any) => {
              const state = (editor as any)._wysiwygView?.state;
              if (state) {
                const linkMark = findLinkMark(state);
                const href = linkMark?.attrs?.href;
                if (typeof href === 'string' && href.startsWith('media:')) {
                  return false;
                }
              }
              return defaultPreset.items.link.wysiwyg?.isActive?.(editorInstance) ?? false;
            },
          },
        },
        // Define mediaMention toolbar button
        mediaMention: {
          view: {
            type: ToolbarDataType.SingleButton,
            title: 'Média',
            hint: 'Lier un média (Ctrl+M)',
            icon: { data: Filmstrip },
            hotkey: 'Ctrl+M',
          },
          wysiwyg: {
            exec: () => {
              triggerMediaModal();
            },
            isActive: (_editorInstance: any) => {
              const state = (editor as any)._wysiwygView?.state;
              if (state) {
                const linkMark = findLinkMark(state);
                const href = linkMark?.attrs?.href;
                return typeof href === 'string' && href.startsWith('media:');
              }
              return false;
            },
            isEnable: () => true,
          },
          markup: {
            exec: () => {
              triggerMediaModal();
            },
            isActive: () => false,
            isEnable: () => true,
          },
        },
      };

      const orders = {
        ...defaultPreset.orders,
        wysiwygMain: defaultPreset.orders.wysiwygMain.map((group: any) => {
          const index = group.indexOf('link');
          if (index !== -1) {
            const nextGroup = [...group];
            nextGroup.splice(index + 1, 0, 'mediaMention');
            return nextGroup;
          }
          return group;
        }),
        markupMain: defaultPreset.orders.markupMain.map((group: any) => {
          const index = group.indexOf('link');
          if (index !== -1) {
            const nextGroup = [...group];
            nextGroup.splice(index + 1, 0, 'mediaMention');
            return nextGroup;
          }
          return group;
        }),
      };

      return { items, orders };
    }, [triggerMediaModal]);

    const insertMention = useCallback((media: Media) => {
      if (!mentionInsertPos) {
        setMentionModalOpen(false);
        return;
      }

      /* --- WYSIWYG --- */
      if (mentionInsertPos.type === 'wysiwyg') {
        const view = (editor as any)._wysiwygView;
        if (view) {
          const { state } = view;
          const schema = state.schema;
          const pos = mentionInsertPos.pos;
          const linkMark = schema.marks.link?.create({ href: `media:${media.id}` });
          if (linkMark) {
            const textNode = schema.text(`@${media.title}`, [linkMark]);
            const tr = state.tr.replaceWith(pos, pos, textNode);
            view.dispatch(tr);
            view.focus();
          }
        }
      }

      /* --- Markup --- */
      if (mentionInsertPos.type === 'markup') {
        const cm = (editor as any).markupEditor?.cm;
        if (cm) {
          const pos = mentionInsertPos.pos;
          const mentionText = `[@${media.title}](media:${media.id}) `;
          cm.dispatch({
            changes: { from: pos, to: pos, insert: mentionText },
            selection: { anchor: pos + mentionText.length },
          });
          cm.focus();
        }
      }

      setMentionModalOpen(false);
      setMentionInsertPos(null);
    }, [editor, mentionInsertPos]);

    const handleClose = useCallback(() => {
      setMentionModalOpen(false);
      setMentionInsertPos(null);
    }, []);

    return (
      <div ref={containerRef} className="gravity-markdown-editor" style={{ minHeight: '120px' }}>
        <MarkdownEditorView
          editor={editor}
          autofocus={autofocus}
          stickyToolbar
          toolbarsPreset={customPreset}
        />
        {mentionModalOpen && (
          <MentionSearchModal
            position={modalPosition}
            collections={collections}
            onSelect={insertMention}
            onClose={handleClose}
          />
        )}
      </div>
    );
  }
);

GravityMarkdownEditor.displayName = 'GravityMarkdownEditor';

export default GravityMarkdownEditor;