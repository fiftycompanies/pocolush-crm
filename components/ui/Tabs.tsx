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
    <div className="flex gap-0 p-[3px] bg-muted rounded-lg h-9 w-fit items-center">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`relative inline-flex items-center justify-center px-3 py-1 text-sm font-medium rounded-md border border-transparent transition-all cursor-pointer whitespace-nowrap ${
            value === tab.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 text-xs ${value === tab.value ? 'text-foreground' : 'text-muted-foreground'}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
