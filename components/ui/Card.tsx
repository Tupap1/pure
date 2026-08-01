import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  glowColor?: 'aeroespacial' | 'software' | 'synergy' | 'warning' | 'none';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverEffect = true,
  glowColor = 'none',
  className = '',
  children,
  ...props
}) => {
  const glowClasses = {
    aeroespacial: 'glow-aeroespacial border-aeroespacial/30',
    software: 'glow-software border-software/30',
    synergy: 'glow-synergy border-synergy/30',
    warning: 'box-shadow-warning border-amber-500/30',
    none: '',
  };

  return (
    <div
      className={`glass-panel rounded-2xl p-5 ${
        hoverEffect ? 'glass-panel-hover' : ''
      } ${glowClasses[glowColor]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
