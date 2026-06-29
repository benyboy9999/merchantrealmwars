import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn.js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

const variantClasses: Record<Variant, string> = {
  primary:   'bg-azure-500 hover:bg-azure-400 active:bg-azure-600 text-white border border-azure-600',
  secondary: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-100 border border-slate-600',
  ghost:     'bg-transparent hover:bg-slate-800 active:bg-slate-900 text-slate-300 hover:text-slate-100 border border-transparent',
  danger:    'bg-red-900/30 hover:bg-red-900/50 active:bg-red-900/60 text-red-400 border border-red-800/40',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs rounded',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-5 py-2.5 text-sm rounded-md font-medium',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-colors select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-500/50',
        'disabled:opacity-40 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
