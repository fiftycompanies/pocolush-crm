import { type LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({ icon: Icon = Inbox, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Icon className="w-12 h-12 text-text-tertiary mb-4" strokeWidth={1.5} />
      <p className="text-[16px] font-semibold text-text-secondary">{title}</p>
      {description && (
        <p className="text-[14px] text-text-tertiary mt-1">{description}</p>
      )}
    </div>
  );
}
