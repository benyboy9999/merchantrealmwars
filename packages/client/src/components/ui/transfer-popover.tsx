import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const W = 248;
const H = 118; // approx height for smart vertical placement

interface TransferPopoverProps {
  /** Short label shown at the top of the popover. */
  label: string;
  maxQty: number;
  /** Viewport-space cursor position from the triggering mouse event. */
  anchor: { x: number; y: number };
  onConfirm: (qty: number) => void;
  onClose: () => void;
  isPending?: boolean;
  /** Optional content rendered between the label and the slider (e.g. a caravan selector). */
  children?: React.ReactNode;
}

/**
 * Cursor-anchored popover for choosing a transfer quantity.
 * No backdrop — closes on outside mousedown or Escape.
 * Portal-rendered so z-index is always correct.
 *
 * Right-click the trigger button to skip this and transfer the full stack.
 */
export function TransferPopover({
  label, maxQty, anchor, children, onConfirm, onClose, isPending = false,
}: TransferPopoverProps) {
  const max = Math.floor(maxQty);
  const [qty, setQty] = useState(max);
  const ref = useRef<HTMLDivElement>(null);

  // Clamp qty if max changes (e.g. optimistic update)
  useEffect(() => { setQty((q) => Math.min(q, Math.floor(maxQty))); }, [maxQty]);

  // Close on outside mousedown
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (max <= 0) return null;

  // Smart placement: above cursor when in bottom half of viewport
  const showAbove = anchor.y > window.innerHeight * 0.55;
  const rawLeft   = anchor.x - W / 2;
  const left      = Math.max(8, Math.min(rawLeft, window.innerWidth - W - 8));
  const top       = showAbove ? anchor.y - H - 10 : anchor.y + 14;

  function commit(n: number) {
    if (n <= 0 || n > max || isPending) return;
    onConfirm(n);
    onClose();
  }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, width: W, zIndex: 60 }}
      className="bg-slate-800 border border-slate-600/80 rounded-xl shadow-2xl p-3.5 space-y-3"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Label */}
      <p className="text-xs text-slate-400 truncate leading-tight">{label}</p>

      {/* Optional slot — e.g. caravan selector */}
      {children}

      {/* Slider */}
      <input
        type="range"
        min={1}
        max={max}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer accent-azure-500"
      />

      {/* Number input + transfer button */}
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="number"
          min={1}
          max={max}
          value={qty}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!isNaN(n)) setQty(Math.max(1, Math.min(max, n)));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(qty);
            if (e.key === 'Escape') onClose();
          }}
          className="w-14 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-100 text-sm text-right focus:outline-none focus:border-azure-500 tabular-nums"
        />
        <span className="text-xs text-slate-600 flex-1 tabular-nums">/ {max}</span>
        <button
          disabled={isPending || qty < 1}
          onClick={() => commit(qty)}
          className="bg-azure-500 hover:bg-azure-400 active:bg-azure-600 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          {isPending ? '…' : 'Transfer'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
