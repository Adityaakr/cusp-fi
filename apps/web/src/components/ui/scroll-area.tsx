import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none rounded-full bg-[hsl(var(--scrollbar-track))] transition-colors duration-200",
      orientation === "vertical" && "h-full w-[var(--scrollbar-size)] border-l border-l-transparent p-px",
      orientation === "horizontal" && "h-[var(--scrollbar-size)] flex-col border-t border-t-transparent p-px",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full border border-[hsl(var(--scrollbar-thumb-border))] bg-[linear-gradient(180deg,hsl(var(--scrollbar-thumb-hover)/0.9)_0%,hsl(var(--scrollbar-thumb))_100%)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.035),0_1px_2px_hsl(0_0%_0%/0.18)] transition-all duration-200 hover:bg-[linear-gradient(180deg,hsl(var(--scrollbar-thumb-hover))_0%,hsl(var(--scrollbar-thumb-active)/0.5)_100%)] hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.045),0_0_0_1px_hsl(var(--cusp-teal)/0.05)] active:bg-[linear-gradient(180deg,hsl(var(--scrollbar-thumb-active))_0%,hsl(var(--cusp-teal)/0.45)_100%)] active:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_0_0_1px_hsl(var(--cusp-teal)/0.08),0_0_10px_hsl(var(--cusp-teal)/0.08)]" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
