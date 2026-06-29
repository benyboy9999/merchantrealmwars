interface ProgressBarProps {
  pct: number;             // 0–1
  color?: string;          // tailwind bg class
  height?: string;         // tailwind h class
  className?: string;
  animated?: boolean;
}

export default function ProgressBar({
  pct,
  color = 'bg-slate-500',
  height = 'h-1',
  className = '',
  animated = true,
}: ProgressBarProps) {
  return (
    <div className={`${height} bg-slate-800 rounded overflow-hidden ${className}`}>
      <div
        className={`${height} rounded ${color} ${animated ? 'transition-all duration-1000 ease-linear' : ''}`}
        style={{ width: `${Math.min(100, Math.max(0, pct * 100)).toFixed(1)}%` }}
      />
    </div>
  );
}
