import { stripInlineMarkdownBold } from "@/components/InlineMarkdownText";
import type { CuspMarket } from "@/lib/dflow-api";
import { cn } from "@/lib/utils";

function initialsFromText(text: string): string {
  const cleaned = stripInlineMarkdownBold(text).replace(/[^A-Za-z0-9 ]/g, " ").trim();
  if (!cleaned) return "MK";
  const words = cleaned.split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || cleaned.slice(0, 2).toUpperCase();
}

function imageFallbackClass(category: string): string {
  const key = category.toLowerCase();
  if (key.includes("polit")) return "from-sky-600 to-slate-700";
  if (key.includes("climate") || key.includes("weather")) return "from-emerald-500 to-cyan-600";
  if (key.includes("crypto")) return "from-amber-500 to-orange-600";
  if (key.includes("sport")) return "from-rose-500 to-orange-500";
  if (key.includes("econom")) return "from-violet-500 to-indigo-600";
  return "from-slate-500 to-slate-700";
}

export function MarketAvatar({
  market,
  className,
}: {
  market: Pick<CuspMarket, "imageUrl" | "competition" | "subCategory" | "category" | "name">;
  className?: string;
}) {
  const label = market.competition || market.subCategory || market.category || market.name;
  const normalizedLabel = stripInlineMarkdownBold(label);

  if (market.imageUrl) {
    return (
      <img
        src={market.imageUrl}
        alt={normalizedLabel}
        className={cn("rounded-xl object-cover ring-1 ring-black/5", className)}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm ring-1 ring-black/5",
        imageFallbackClass(market.category),
        className
      )}
      aria-hidden="true"
    >
      {initialsFromText(label)}
    </div>
  );
}
