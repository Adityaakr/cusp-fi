import { Fragment } from "react";

const INLINE_BOLD_PATTERN = /\*\*(.+?)\*\*/g;

export function stripInlineMarkdownBold(text: string): string {
  return text.replace(INLINE_BOLD_PATTERN, "$1");
}

export function InlineMarkdownText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.+?\*\*)/g).filter(Boolean);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\*\*(.+?)\*\*$/);
        if (match) {
          return (
            <strong key={`${match[1]}-${index}`} className="font-semibold">
              {match[1]}
            </strong>
          );
        }

        return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
      })}
    </>
  );
}
