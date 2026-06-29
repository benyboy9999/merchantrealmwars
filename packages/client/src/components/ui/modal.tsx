import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn.js';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: ModalSize;
  /** Rendered in a sticky footer bar beneath scrollable body content. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Prevent closing by clicking the backdrop. */
  disableBackdropClose?: boolean;
}

/**
 * Consistent action window for the game.
 * - Desktop: centred dialog
 * - Mobile:  bottom sheet with drag-handle pill
 *
 * Closes on Escape and backdrop click. Locks body scroll while open.
 * Renders via React portal so z-index stacking is always correct.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  children,
  disableBackdropClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Focus trap — move focus into panel when it opens
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    el?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'relative z-10 w-full flex flex-col',
          'bg-slate-900 border-t border-slate-700/80 sm:border shadow-2xl',
          'rounded-t-2xl sm:rounded-2xl',
          // max height — dvh so mobile browser chrome is excluded
          'max-h-[90dvh] sm:max-h-[85dvh]',
          sizeMap[size],
        )}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        {/* Header — shown when title is supplied */}
        {(title != null || subtitle != null) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:pt-5 pb-4 border-b border-slate-800 flex-shrink-0">
            <div className="min-w-0">
              {title    && <h2 className="text-slate-100 font-semibold text-base leading-tight truncate">{title}</h2>}
              {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {children}
        </div>

        {/* Sticky footer */}
        {footer != null && (
          <div className="flex-shrink-0 border-t border-slate-800 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Structural sub-components ─────────────────────────────────────────────────

/** Adds standard horizontal padding + vertical rhythm inside the modal body. */
export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 py-4', className)}>
      {children}
    </div>
  );
}

/**
 * Labelled section within a modal body.
 * Draws a bottom divider on all but the last child.
 */
export function ModalSection({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 py-4 border-b border-slate-800 last:border-0', className)}>
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}
