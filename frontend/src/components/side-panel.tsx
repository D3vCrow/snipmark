import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Palette,
  Trash2,
} from 'lucide-react';
import { Annotation, Expandable, MarkKind } from '../types';
import { noteColor } from '../lib/note-palette';

// How far one reveal click grows an edge, in physical screen pixels. A step
// big enough to matter, small enough to stay deliberate; hold repeat-clicks
// for more. Requests past the screen edge clamp Go-side.
const REVEAL_STEP = 96;

const KIND_OPTIONS: (MarkKind | '')[] = ['', 'ask', 'more', 'less', 'keep', 'move', 'wrong', 'cut'];

interface SidePanelProps {
  side: 'left' | 'right';
  width: number;
  onSideFlip: () => void;
  onWidthChange: (w: number) => void;
  colorPerNumber: boolean;
  onColorPerNumberChange: (v: boolean) => void;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  // null = no backing capture exists (fullscreen/window/library images);
  // reveal UI hides entirely then, instead of showing four dead buttons.
  expandable: Expandable | null;
  onReveal: (left: number, top: number, right: number, bottom: number) => void;
  revealBusy: boolean;
  children: ReactNode;
}

/**
 * The tool column beside the canvas: annotation tools (passed as children so
 * their wiring stays in App), the reveal controls for backed snips, and the
 * notes list - one row per numbered note, which is where note text is written.
 *
 * Resizable by dragging its canvas-facing edge; flips left/right. The canvas
 * never shrinks below 1:1 to make room - this panel takes width and the
 * canvas scrolls instead.
 */
export function SidePanel({
  side,
  width,
  onSideFlip,
  onWidthChange,
  colorPerNumber,
  onColorPerNumberChange,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  expandable,
  onReveal,
  revealBusy,
  children,
}: SidePanelProps) {
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Drag-to-resize: track pointer relative to the panel's fixed (outer) edge,
  // so the width follows the cursor no matter which side the panel sits on.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      const w = side === 'right' ? rect.right - e.clientX : e.clientX - rect.left;
      onWidthChange(Math.min(520, Math.max(240, Math.round(w))));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, side, onWidthChange]);

  const noteRows = annotations
    .filter((a) => a.type === 'number')
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const canRevealAny =
    !!expandable && (expandable.left || expandable.top || expandable.right || expandable.bottom);

  const chipColor = useCallback(
    (a: Annotation) => (colorPerNumber ? noteColor(a.number ?? 1) : a.stroke ?? '#ef4444'),
    [colorPerNumber]
  );

  const resizeHandle = (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      className={`w-1 flex-none cursor-col-resize transition-colors ${
        dragging ? 'bg-violet-500/60' : 'bg-white/10 hover:bg-violet-500/40'
      }`}
      title="Drag to resize the panel"
    />
  );

  return (
    <div className="flex flex-none h-full">
      {side === 'right' && resizeHandle}
      <div
        ref={panelRef}
        style={{ width }}
        className="flex flex-col h-full glass-light border-l border-r border-white/10 overflow-hidden"
      >
        {/* Panel header: flip side + colour toggle */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-xs text-slate-400 font-medium">Tools</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onColorPerNumberChange(!colorPerNumber)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                colorPerNumber
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={colorPerNumber ? 'Note colours: per note (on)' : 'Note colours: single colour (off)'}
            >
              <Palette className="w-5 h-5" />
            </button>
            <button
              onClick={onSideFlip}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              title={`Move panel to the ${side === 'right' ? 'left' : 'right'}`}
            >
              <ArrowLeftRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
          {/* Annotation tools + note input for the selected mark */}
          <div className="px-2 py-2 border-b border-white/10">{children}</div>

          {/* Reveal more of the screen around a backed snip */}
          {canRevealAny && (
            <div className="px-3 py-2 border-b border-white/10">
              <div className="text-xs text-slate-400 font-medium mb-2">
                Reveal around the snip
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onReveal(REVEAL_STEP, 0, 0, 0)}
                  disabled={revealBusy || !expandable?.left}
                  className="p-2 rounded-lg transition-all duration-200 text-slate-400 hover:text-white hover:bg-white/10 disabled:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Reveal more on the left"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onReveal(0, REVEAL_STEP, 0, 0)}
                  disabled={revealBusy || !expandable?.top}
                  className="p-2 rounded-lg transition-all duration-200 text-slate-400 hover:text-white hover:bg-white/10 disabled:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Reveal more above"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onReveal(0, 0, 0, REVEAL_STEP)}
                  disabled={revealBusy || !expandable?.bottom}
                  className="p-2 rounded-lg transition-all duration-200 text-slate-400 hover:text-white hover:bg-white/10 disabled:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Reveal more below"
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onReveal(0, 0, REVEAL_STEP, 0)}
                  disabled={revealBusy || !expandable?.right}
                  className="p-2 rounded-lg transition-all duration-200 text-slate-400 hover:text-white hover:bg-white/10 disabled:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Reveal more on the right"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onReveal(REVEAL_STEP, REVEAL_STEP, REVEAL_STEP, REVEAL_STEP)}
                  disabled={revealBusy}
                  className="p-2 rounded-lg transition-all duration-200 text-slate-400 hover:text-white hover:bg-white/10 disabled:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Reveal on every side"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Notes: appears with the first numbered note (requirement) */}
          {noteRows.length > 0 && (
            <div className="px-3 py-2">
              <div className="text-xs text-slate-400 font-medium mb-2">
                Notes ({noteRows.length})
              </div>
              <div className="flex flex-col gap-2">
                {noteRows.map((a) => {
                  const isSelected = a.id === selectedAnnotationId;
                  return (
                    <div
                      key={a.id}
                      onClick={() => onSelectAnnotation(a.id)}
                      className={`rounded-lg border p-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-violet-500/60 bg-white/5'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="flex-none w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                          style={{ background: chipColor(a) }}
                        >
                          {a.number}
                        </span>
                        <select
                          value={a.kind ?? ''}
                          onChange={(e) =>
                            onUpdateAnnotation(a.id, {
                              kind: (e.target.value || undefined) as MarkKind | undefined,
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white/5 border border-white/10 rounded-lg text-slate-200 text-xs px-1 py-1 focus:outline-none focus:border-violet-500/50"
                          title="Kind of mark"
                        >
                          {KIND_OPTIONS.map((k) => (
                            <option key={k} value={k} className="bg-slate-800">
                              {k === '' ? 'note' : k}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAnnotation(a.id);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-white/10 transition-colors"
                          title="Delete this note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={a.note ?? ''}
                        placeholder="what about it?"
                        rows={2}
                        onChange={(e) => onUpdateAnnotation(a.id, { note: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full resize-y px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {side === 'left' && resizeHandle}
    </div>
  );
}
