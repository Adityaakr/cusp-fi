import type { QvacFlow } from "@/components/qvac/qvacFlows";
import { Sparkles } from "lucide-react";

interface QvacSuggestionsProps {
  suggestions: QvacFlow[];
  contextLabel: string;
  onSelect: (flow: QvacFlow) => void;
}

export default function QvacSuggestions({ suggestions, contextLabel, onSelect }: QvacSuggestionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3" />
        <span>
          Suggested for <span className="text-cusp-teal font-medium">{contextLabel}</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((flow) => {
          const Icon = flow.icon;
          return (
            <button
              key={flow.id}
              onClick={() => onSelect(flow)}
              className="inline-flex items-center gap-1.5 border border-cusp-teal/30 text-cusp-teal hover:bg-cusp-teal/10 rounded-full px-3 py-1.5 text-sm transition-colors"
            >
              <Icon className="size-3.5" />
              <span>{flow.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}