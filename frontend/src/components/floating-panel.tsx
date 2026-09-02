import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';

// A draggable floating card - the "tools move independently of the image"
// ruling (Chris, 2026-09-02). Wails v2 gives one native window per process,
// so true separate OS windows for the palette would need cross-process state
// sync; a floating palette over a full-bleed canvas gives the independent
// positioning without it. Position persists per panel id.

interface FloatingPanelProps {
  id: string; // localStorage key suffix; also lets two panels coexist
  initialX: number;
  initialY: number;
  children: ReactNode;
}

interface Pos {
  x: number;
  y: number;
}

function loadPos(id: string, fallback: Pos): Pos {
  try {
    const raw = localStorage.getItem(`snipmark.panelpos.${id}`);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Pos;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return fallback;
    return p;
  } catch {
    return fallback;
  }
}

export function FloatingPanel({ id, initialX, initialY, children }: FloatingPanelProps) {
  const [pos, setPos] = useState<Pos>(() => loadPos(id, { x: initialX, y: initialY }));
  const [dragging, setDragging] = useState(false);
  const grabOffset = useRef<Pos>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Clamp so the drag handle can never leave the window - an off-screen
  // handle would strand the panel with no way to pull it back.
  const clamp = useCallback((p: Pos): Pos => {
    const w = panelRef.current?.offsetWidth ?? 280;
    return {
      x: Math.min(Math.max(p.x, 8 - w + 60), window.innerWidth - 60),
      y: Math.min(Math.max(p.y, 0), window.innerHeight - 40),
    };
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      setPos(clamp({ x: e.clientX - grabOffset.current.x, y: e.clientY - grabOffset.current.y }));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, clamp]);

  useEffect(() => {
    localStorage.setItem(`snipmark.panelpos.${id}`, JSON.stringify(pos));
  }, [id, pos]);

  // Re-clamp when the window shrinks, so a palette parked far right on a big
  // window is still reachable after a resize.
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  return (
    <div
      ref={panelRef}
      className="absolute z-30 rounded-xl border border-white/15 shadow-2xl shadow-black/50 overflow-hidden"
      style={{ left: pos.x, top: pos.y, background: 'rgba(15, 17, 32, 0.92)' }}
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          const rect = panelRef.current?.getBoundingClientRect();
          grabOffset.current = { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
          setDragging(true);
        }}
        className={`flex items-center justify-center py-1 cursor-grab select-none border-b border-white/10 ${
          dragging ? 'cursor-grabbing bg-white/10' : 'hover:bg-white/5'
        }`}
        title="Drag to move this panel"
      >
        <GripHorizontal className="w-5 h-4 text-slate-500" />
      </div>
      {children}
    </div>
  );
}
