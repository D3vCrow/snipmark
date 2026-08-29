import { MessageSquareText } from 'lucide-react';
import { Annotation } from '../types';

interface MarkNoteInputProps {
  annotation?: Annotation; // The currently selected annotation, if any
  onNoteChange: (note: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

/**
 * One line of text attached to the selected mark. The toolbar above says which
 * verdict the mark carries; this says what about it.
 *
 * The row renders even when nothing is selected, disabled - the same way the
 * toolbar keeps its mark-kind buttons visible and disabled. Two reasons: it
 * advertises the field exists, and it keeps the layout height constant.
 * EditorCanvas caches its container size and only re-measures on window resize,
 * so a row that appeared on selection would leave the stage fitted to a height
 * the container no longer has, clipping the bottom of the canvas.
 *
 * Focus does NOT follow selection. Every shape is auto-selected the moment it is
 * drawn, so focusing here on selection would swallow the tool shortcuts, Delete
 * and the 1-6 kind keys the instant the user drew anything. Enter moves focus
 * in, Enter or Escape moves it back out.
 */
export function MarkNoteInput({ annotation, onNoteChange, inputRef }: MarkNoteInputProps) {
  const hasSelection = !!annotation;

  return (
    <div className="flex items-center gap-2 px-3 py-2 glass-light">
      <MessageSquareText
        className={`w-5 h-5 shrink-0 ${hasSelection ? 'text-slate-400' : 'text-slate-600 opacity-50'}`}
      />
      <span className="text-xs text-slate-400 font-medium">Note</span>

      {/* The verdict already on this mark, echoed so the note has a subject */}
      {annotation?.kind && (
        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
          {annotation.kind}
        </span>
      )}

      <input
        ref={inputRef}
        type="text"
        value={annotation?.note ?? ''}
        disabled={!hasSelection}
        placeholder={hasSelection ? 'What about it?' : 'Select a mark to write a note'}
        onChange={(e) => onNoteChange(e.target.value)}
        onKeyDown={(e) => {
          // Hand the keyboard back to the canvas shortcuts.
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.currentTarget.blur();
          }
        }}
        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 disabled:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
