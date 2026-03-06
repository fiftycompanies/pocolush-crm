interface BadgeProps {
  label: string;
  color: string;
  bg?: string;
  className?: string;
}

export default function Badge({ label, color, bg, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-xs font-medium ${className}`}
      style={{
        color,
        backgroundColor: bg || `${color}15`,
      }}
    >
      {label}
    </span>
  );
}
