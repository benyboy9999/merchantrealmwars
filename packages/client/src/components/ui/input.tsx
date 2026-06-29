import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from './cn.js';

const baseInput = [
  'w-full bg-slate-900 border border-slate-700 rounded-md',
  'text-slate-100 placeholder:text-slate-500 text-sm',
  'focus:outline-none focus:border-azure-500 focus:ring-1 focus:ring-azure-500/30',
  'transition-colors',
].join(' ');

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        baseInput,
        'px-3 py-2',
        error && 'border-red-600 focus:border-red-500 focus:ring-red-500/30',
        className,
      )}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ className, error, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        baseInput,
        'px-3 py-2 cursor-pointer',
        error && 'border-red-600 focus:border-red-500 focus:ring-red-500/30',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
