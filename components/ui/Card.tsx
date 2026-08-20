import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverEffect = true,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-surface border border-surface-border rounded-xl p-6 transition-all duration-200',
        hoverEffect && 'hover:border-surface-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
