import { cn } from "@/lib/utils";

export interface MarketsSidebarItem {
  tag: string | null;
  label: string;
  count?: number;
}

interface MarketsCategorySidebarProps {
  title: string;
  items: MarketsSidebarItem[];
  selectedSubTag: string | null;
  onSelectAll: () => void;
  onSelectItem: (tag: string | null) => void;
}

const MarketsCategorySidebar = ({
  title,
  items,
  selectedSubTag,
  onSelectAll,
  onSelectItem,
}: MarketsCategorySidebarProps) => {
  return (
    <nav
      className="rounded-lg border border-border bg-bg-1 overflow-hidden flex flex-col max-h-[min(70vh,42rem)] lg:max-h-[calc(100vh-5.5rem)]"
      aria-label={`${title} subcategories`}
    >
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="overflow-y-auto overscroll-contain py-1 px-0.5 flex-1 min-h-0">
        {items.map((item) => {
          const isAll = item.tag == null;
          const active = isAll ? selectedSubTag == null : selectedSubTag === item.tag;
          return (
            <button
              key={item.tag ?? "__all__"}
              type="button"
              onClick={() => (isAll ? onSelectAll() : onSelectItem(item.tag))}
              className={cn(
                "w-full text-left pl-3 pr-2 py-2.5 text-sm transition-colors border-l-2",
                active
                  ? "text-cusp-teal font-semibold bg-bg-2/90 border-cusp-teal"
                  : "text-foreground font-medium hover:bg-bg-2/50 border-transparent"
              )}
            >
              <span>{item.label}</span>
              {typeof item.count === "number" && (
                <span className="ml-1 font-normal text-muted-foreground tabular-nums">({item.count})</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MarketsCategorySidebar;
