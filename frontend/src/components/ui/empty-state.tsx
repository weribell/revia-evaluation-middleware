import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * "There is nothing here yet, and here is why" — a dashed, quiet surface so an
 * empty panel still reads as a deliberate state rather than a loading bug.
 */
function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-surface-soft px-4 py-4 text-sm leading-6 text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  )
}

export { EmptyState }
