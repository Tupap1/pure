import React from 'react';

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
      className={`bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 shadow-sm transition-all duration-200 ${
        hoverEffect ? 'hover:border-cyan-500/40 dark:hover:border-slate-700 hover:shadow-md' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
