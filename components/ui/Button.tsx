import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'aeroespacial' | 'software' | 'synergy' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-heading font-bold tracking-tight rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer';

  const variantClasses = {
    primary:
      'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-100 border border-slate-700/60 hover:border-slate-600/80 focus:ring-cyan-500 shadow-sm',
    aeroespacial:
      'bg-cyan-500/8 hover:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 dark:border-cyan-500/30 hover:border-cyan-400/60 focus:ring-cyan-400',
    software:
      'bg-purple-500/8 hover:bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 dark:border-purple-500/30 hover:border-purple-400/60 focus:ring-purple-400',
    synergy:
      'bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 dark:border-emerald-500/30 hover:border-emerald-400/60 focus:ring-emerald-400',
    danger:
      'bg-rose-500/8 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 dark:border-rose-500/30 hover:border-rose-400/60 focus:ring-rose-400',
    ghost:
      'bg-transparent hover:bg-slate-100/40 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent',
  };

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 font-medium',
    md: 'text-sm px-4 py-2 gap-2 font-semibold',
    lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold',
  };

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};
