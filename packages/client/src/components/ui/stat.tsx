import { cn } from './cn.js';

interface StatProps {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  className?: string;
}

/** A compact label/value pair for headers and info panels. */
export function Stat({ label, value, valueClassName, className }: StatProps) {
  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn('text-sm text-slate-200 tabular-nums', valueClassName)}>{value}</span>
    </div>
  );
}
