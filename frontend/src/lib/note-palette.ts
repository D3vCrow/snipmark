// Per-note colours for numbered notes. Deterministic by number, so note 3 is
// the same colour in the canvas pin, the side-panel row, and across sessions
// - and deleting note 2 never recolours the others.
//
// Ten hues picked to stay tellable-apart on both dark UI screenshots and
// light document screenshots. After ten the cycle repeats; a feedback pass
// with more than ten simultaneous notes still reads because the number is
// inside the pin.
export const NOTE_PALETTE = [
  '#ef4444', // 1 red
  '#f59e0b', // 2 amber
  '#22c55e', // 3 green
  '#3b82f6', // 4 blue
  '#a855f7', // 5 purple
  '#ec4899', // 6 pink
  '#14b8a6', // 7 teal
  '#eab308', // 8 yellow
  '#f97316', // 9 orange
  '#06b6d4', // 10 cyan
] as const;

export function noteColor(noteNumber: number): string {
  const n = Number.isFinite(noteNumber) && noteNumber >= 1 ? Math.floor(noteNumber) : 1;
  return NOTE_PALETTE[(n - 1) % NOTE_PALETTE.length];
}
