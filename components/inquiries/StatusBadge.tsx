import Badge from '@/components/ui/Badge';
import { INQUIRY_STATUS } from '@/lib/constants';

export default function StatusBadge({ status }: { status: string }) {
  const meta = INQUIRY_STATUS[status] || INQUIRY_STATUS.new;
  return <Badge label={meta.label} color={meta.color} bg={meta.bg} />;
}
