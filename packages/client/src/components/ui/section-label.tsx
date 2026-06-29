import type { HTMLAttributes } from 'react';
import { cn } from './cn.js';

export function SectionLabel({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-xs font-semibold uppercase tracking-widest text-slate-500', className)}
      {...props}
    >
      {children}
    </p>
  );
}
