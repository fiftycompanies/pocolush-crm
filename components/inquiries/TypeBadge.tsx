import Badge from '@/components/ui/Badge';
import { INQUIRY_TYPES } from '@/lib/constants';

export default function TypeBadge({ type }: { type: string }) {
  const meta = INQUIRY_TYPES[type] || { label: type, color: '#6B7280', emoji: '📋' };
  return <Badge label={`${meta.emoji} ${meta.label}`} color={meta.color} />;
}
