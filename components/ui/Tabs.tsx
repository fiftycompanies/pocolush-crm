interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
}

export default function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex gap-6 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`relative pb-3 text-[14px] transition-colors cursor-pointer ${
            value === tab.value
              ? 'text-text-primary font-semibold'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 text-[12px] ${value === tab.value ? 'text-primary' : 'text-text-tertiary'}`}>
              {tab.count}
            </span>
          )}
          {value === tab.value && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
