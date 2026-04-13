import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div
      className={`bg-card text-card-foreground flex flex-col gap-6 rounded-xl border shadow-sm ${padding ? 'py-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
