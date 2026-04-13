interface BadgeProps {
  label: string;
  color: string;
  bg?: string;
  className?: string;
}

export default function Badge({ label, color, bg, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 ${className}`}
      style={{
        color,
        backgroundColor: bg || `${color}12`,
      }}
    >
      {label}
    </span>
  );
}
