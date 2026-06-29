import { cn } from './cn.js';

type Size = 'sm' | 'md' | 'lg';

const sizeClasses: Record<Size, string> = {
  sm: 'w-3 h-3 border',
  md: 'w-5 h-5 border-2',
  lg: 'w-7 h-7 border-2',
};

export function Spinner({ size = 'md', className }: { size?: Size; className?: string }) {
  return (
    <span
      role="status"
      className={cn(
        'inline-block rounded-full border-slate-700 border-t-azure-400 animate-spin',
        sizeClasses[size],
        className,
      )}
    />
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500 text-sm">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <span className="text-red-400 text-sm">{message}</span>
    </div>
  );
}
