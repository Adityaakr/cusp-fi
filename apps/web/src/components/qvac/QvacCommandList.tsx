import { QVAC_FLOWS } from "@/components/qvac/qvacFlows";
import { useQvac } from "@/components/qvac/QvacProvider";
import { useQvacContext } from "@/hooks/useQvacContext";
import QvacAssistantChat from "@/components/qvac/QvacAssistantChat";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import QvacSuggestions from "@/components/qvac/QvacSuggestions";

export default function QvacCommandList() {
  const { selectFlow } = useQvac();
  const { suggestions, contextLabel } = useQvacContext();

  const grouped = QVAC_FLOWS.reduce<Record<string, typeof QVAC_FLOWS>>((acc, flow) => {
    if (!acc[flow.category]) acc[flow.category] = [];
    acc[flow.category].push(flow);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      <QvacAssistantChat />
      <QvacSuggestions suggestions={suggestions} contextLabel={contextLabel} onSelect={selectFlow} />
      <div className="px-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-bg-2 text-[11px] text-muted-foreground">
            →
          </span>
          Structured actions
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Or choose a guided flow for trading, borrowing, lending, or leverage.
        </p>
      </div>
      <Command className="rounded-xl border border-border bg-bg-1">
        <CommandInput placeholder="Type a command or action..." className="text-foreground" />
        <CommandList className="max-h-[320px]">
          <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
            No commands found.
          </CommandEmpty>
          {Object.entries(grouped).map(([category, flows]) => (
            <CommandGroup key={category} heading={category} className="text-muted-foreground">
              {flows.map((flow) => {
                const Icon = flow.icon;
                return (
                  <CommandItem
                    key={flow.id}
                    value={`${flow.label} ${flow.category} ${flow.id}`}
                    onSelect={() => selectFlow(flow)}
                    className="flex items-center gap-3 px-3 py-2.5 text-foreground cursor-pointer data-[selected=true]:bg-cusp-teal/10 data-[selected=true]:text-cusp-teal"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{flow.label}</span>
                      <span className="text-xs text-muted-foreground">{flow.description}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}
