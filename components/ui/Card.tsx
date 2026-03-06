import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div
      className={`bg-white border border-border rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${padding ? 'p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
