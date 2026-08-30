import { cn } from "@/lib/utils"

import { formatSourceExcerptBlocks } from "./sourceExcerptFormatting"

export function SourceExcerptText({
  className,
  emptyLabel = "-",
  text,
}: {
  className?: string
  emptyLabel?: string
  text: string
}) {
  const blocks = formatSourceExcerptBlocks(text || "")

  if (!blocks.length) {
    return <div className={cn("text-sm leading-6 text-muted-foreground", className)}>{emptyLabel}</div>
  }

  return (
    <div className={cn("grid gap-2 text-sm leading-6 text-body", className)}>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}-${block.text.slice(0, 24)}`
        if (block.kind === "heading") {
          return (
            <div key={key} className="font-semibold text-foreground">
              {block.text}
            </div>
          )
        }
        if (block.kind === "bullet") {
          return (
            <div key={key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <span aria-hidden="true" className="text-muted-foreground">
                -
              </span>
              <span>{block.text}</span>
            </div>
          )
        }
        return <p key={key}>{block.text}</p>
      })}
    </div>
  )
}
