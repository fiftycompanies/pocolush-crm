interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-2xl p-6 space-y-3">
      <Skeleton width="40%" height={14} />
      <Skeleton width="60%" height={32} />
      <Skeleton width="30%" height={12} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 bg-bg-page border-b border-border">
        <Skeleton width="100%" height={16} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-4 border-b border-[#F3F4F6] flex gap-4">
          <Skeleton width="15%" height={14} />
          <Skeleton width="20%" height={14} />
          <Skeleton width="25%" height={14} />
          <Skeleton width="15%" height={14} />
        </div>
      ))}
    </div>
  );
}
