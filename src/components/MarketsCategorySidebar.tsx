import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarketsSidebarChild {
  tag: string;
  label: string;
  count: number;
}

export interface MarketsSidebarItem {
  label: string;
  count: number;
  children?: MarketsSidebarChild[];
}

interface MarketsCategorySidebarProps {
  items: MarketsSidebarItem[];
  selectedCategory: string;
  selectedSubTag: string | null;
  expandedLabels: Set<string>;
  onSelectAll: () => void;
  onSelectCategory: (label: string) => void;
  onSelectChild: (parentLabel: string, tag: string) => void;
  onToggleExpand: (parentLabel: string) => void;
}

function tagDisplayLabel(tag: string): string {
  const t = tag.trim();
  if (!t) return tag;
  const stripped = t.replace(/^KX/i, "").replace(/[-_]+/g, " ").trim();
  if (stripped.length <= 36) return stripped || t;
  return `${stripped.slice(0, 34)}…`;
}

export { tagDisplayLabel };

const MarketsCategorySidebar = ({
  items,
  selectedCategory,
  selectedSubTag,
  expandedLabels,
  onSelectAll,
  onSelectCategory,
  onSelectChild,
  onToggleExpand,
}: MarketsCategorySidebarProps) => {
  return (
    <nav
      className="rounded-lg border border-border bg-bg-1 overflow-hidden flex flex-col max-h-[min(70vh,42rem)] lg:max-h-[calc(100vh-5.5rem)]"
      aria-label="Market categories"
    >
      <div className="overflow-y-auto overscroll-contain py-1 px-0.5 flex-1 min-h-0">
        {items.map((item) => {
          const isAll = item.label === "All";
          const expandable = (item.children?.length ?? 0) > 1;
          const expanded = expandedLabels.has(item.label);
          const parentActive = isAll
            ? selectedCategory === "All"
            : selectedCategory === item.label && selectedSubTag == null;
          const showChildren = expandable && expanded;

          return (
            <div key={item.label} className="border-b border-border/60 last:border-b-0">
              <div className="flex items-stretch gap-0 min-h-[2.25rem]">
                <button
                  type="button"
                  onClick={() => (isAll ? onSelectAll() : onSelectCategory(item.label))}
                  className={cn(
                    "flex-1 text-left pl-2.5 pr-1 py-2 text-sm transition-colors",
                    parentActive
                      ? "text-cusp-teal font-semibold bg-bg-2/90 border-l-2 border-cusp-teal"
                      : "text-foreground font-medium hover:bg-bg-2/50 border-l-2 border-transparent"
                  )}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="ml-1 font-normal text-muted-foreground tabular-nums">({item.count})</span>
                </button>
                {expandable && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleExpand(item.label);
                    }}
                    className="shrink-0 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-bg-2/40 transition-colors"
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")}
                    />
                  </button>
                )}
              </div>

              {showChildren &&
                item.children!.map((ch) => {
                  const childActive = selectedCategory === item.label && selectedSubTag === ch.tag;
                  return (
                    <button
                      key={`${item.label}-${ch.tag}`}
                      type="button"
                      onClick={() => onSelectChild(item.label, ch.tag)}
                      className={cn(
                        "w-full text-left pl-5 pr-2 py-1.5 text-xs transition-colors border-l-2",
                        childActive
                          ? "text-cusp-teal font-medium bg-bg-2/70 border-cusp-teal"
                          : "text-muted-foreground hover:text-foreground hover:bg-bg-2/40 border-transparent"
                      )}
                    >
                      <span className="font-medium text-foreground/90">{ch.label}</span>
                      <span className="ml-1 text-muted-foreground tabular-nums font-normal">({ch.count})</span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export default MarketsCategorySidebar;
