import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'danger' | 'ghost';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  'aria-label': ariaLabel,
  size = 'md',
  variant = 'default',
  className,
  ...props
}) => {
  const sizeClasses = {
    sm: 'p-1.5 min-h-[36px] min-w-[36px]',
    md: 'p-2 min-h-[44px] min-w-[44px]',
    lg: 'p-2.5 min-h-[48px] min-w-[48px]',
  };

  const variantClasses = {
    default: 'text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-surface-subtle border-surface-border',
    danger: 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-surface-border',
    ghost: 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-surface-subtle border-transparent',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border text-xs transition-colors shrink-0 font-sans',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      <Icon className={cn(iconSizes[size], 'shrink-0')} />
    </button>
  );
};
