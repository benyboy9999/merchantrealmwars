import type { HTMLAttributes } from 'react';
import { cn } from './cn.js';

type Variant = 'default' | 'active' | 'warning' | 'error' | 'blue' | 'gold';

const variantClasses: Record<Variant, string> = {
  default: 'bg-slate-800 text-slate-400 border border-slate-700',
  active:  'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50',
  warning: 'bg-amber-900/40 text-amber-400 border border-amber-800/50',
  error:   'bg-red-900/40 text-red-400 border border-red-800/50',
  blue:    'bg-azure-900/30 text-azure-400 border border-azure-800/40',
  gold:    'bg-amber-900/30 text-gold-400 border border-amber-800/40',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
