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
      'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-100 border border-slate-700/60 hover:border-slate-600/80 focus:ring-slate-400 shadow-sm',
    aeroespacial:
      'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-aeroespacial border border-black/[0.07] dark:border-white/[0.09] focus:ring-aeroespacial',
    software:
      'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-software border border-black/[0.07] dark:border-white/[0.09] focus:ring-software',
    synergy:
      'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-synergy border border-black/[0.07] dark:border-white/[0.09] focus:ring-synergy',
    danger:
      'bg-red-500/[0.08] hover:bg-red-500/[0.14] text-red-600 dark:text-red-400 border border-red-500/25 hover:border-red-500/50 focus:ring-red-400',
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
