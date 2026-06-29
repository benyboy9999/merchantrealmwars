import type { HTMLAttributes } from 'react';
import { cn } from './cn.js';

type Variant = 'default' | 'elevated' | 'inset' | 'ghost';

const variantClasses: Record<Variant, string> = {
  default:  'bg-slate-900 border border-slate-700/60 rounded-xl',
  elevated: 'bg-slate-800 border border-slate-700 rounded-xl shadow-lg',
  inset:    'bg-slate-950 border border-slate-800 rounded-xl',
  ghost:    'rounded-xl',
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div className={cn(variantClasses[variant], className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 py-3 border-b border-slate-700/60', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
}
