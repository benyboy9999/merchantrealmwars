import { cn } from './cn.js';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<Size, string> = {
  xs: 'w-6  h-6  text-[8px] rounded',
  sm: 'w-8  h-8  text-xs    rounded-md',
  md: 'w-10 h-10 text-sm    rounded-lg',
  lg: 'w-14 h-14 text-base  rounded-lg',
  xl: 'w-20 h-20 text-xl    rounded-xl',
};

interface IconSlotProps {
  /** Short label used to generate a placeholder monogram when no image is available. */
  label?: string;
  /** Image URL — renders the actual sprite/icon when available. */
  src?: string;
  size?: Size;
  className?: string;
}

/**
 * Container for building/resource sprites.
 * Renders a styled monogram placeholder until real art is available.
 * Drop an image via `src` and it renders cleanly without layout changes.
 */
export function IconSlot({ label, src, size = 'md', className }: IconSlotProps) {
  const monogram = label ? label.slice(0, 2).toUpperCase() : '?';

  return (
    <div
      className={cn(
        'flex-shrink-0 flex items-center justify-center overflow-hidden',
        'bg-slate-800 border border-slate-700/60',
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={label} className="w-full h-full object-cover" />
      ) : (
        <span className="font-mono font-semibold text-slate-500 select-none leading-none">
          {monogram}
        </span>
      )}
    </div>
  );
}
