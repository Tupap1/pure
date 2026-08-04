import React from 'react';

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
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer';

  const variantClasses = {
    primary:
      'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-100 border border-slate-700/80 hover:border-slate-600 focus:ring-slate-500 shadow-sm',
    aeroespacial:
      'bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 dark:border-sky-500/40 hover:border-sky-600/60 dark:hover:border-sky-400/60 focus:ring-sky-400 glow-aeroespacial',
    software:
      'bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 dark:border-purple-500/40 hover:border-purple-600/60 dark:hover:border-purple-400/60 focus:ring-purple-400 glow-software',
    synergy:
      'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 dark:border-emerald-500/40 hover:border-emerald-600/60 dark:hover:border-emerald-400/60 focus:ring-emerald-400 glow-synergy',
    danger:
      'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 dark:border-rose-500/40 hover:border-rose-600/60 dark:hover:border-rose-400/60 focus:ring-rose-400',
    ghost:
      'bg-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent',
  };

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 font-medium',
    md: 'text-sm px-4 py-2 gap-2 font-semibold',
    lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};


