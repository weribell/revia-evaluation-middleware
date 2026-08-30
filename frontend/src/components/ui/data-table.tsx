import { createContext, useContext, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The grid-based table the dashboards already use (lilac header row over white
 * rows), extracted so the column template is declared once instead of being
 * repeated verbatim on the header and on every row — the previous shape, and
 * the reason a column width fix could silently miss one of the two places.
 *
 * The template goes through inline style rather than a Tailwind class because
 * arbitrary `grid-cols-[...]` values must be literal in the source to be
 * generated, which rules out passing them as a prop.
 */
const DataTableColumnsContext = createContext("")

function DataTable({
  children,
  className,
  columns,
  minWidth,
}: {
  children: ReactNode
  className?: string
  /** A CSS `grid-template-columns` value, e.g. `"1.25fr 0.5fr 0.5fr"`. */
  columns: string
  /** Width below which the table scrolls horizontally instead of squashing. */
  minWidth?: string
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-x-auto rounded-2xl border border-border bg-card shadow-card",
        className,
      )}
    >
      <div style={minWidth ? { minWidth } : undefined}>
        <DataTableColumnsContext.Provider value={columns}>
          {children}
        </DataTableColumnsContext.Provider>
      </div>
    </div>
  )
}

function DataTableHeader({ children, className }: { children: ReactNode; className?: string }) {
  const columns = useContext(DataTableColumnsContext)

  return (
    <div
      className={cn(
        "grid gap-3 border-b border-surface-head-border bg-surface-head px-4 py-2.5 text-caps uppercase text-label",
        className,
      )}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  )
}

function DataTableRow({ children, className }: { children: ReactNode; className?: string }) {
  const columns = useContext(DataTableColumnsContext)

  return (
    <div
      className={cn(
        "grid gap-3 border-b border-row-border px-4 py-3 text-sm last:border-0",
        className,
      )}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  )
}

export { DataTable, DataTableHeader, DataTableRow }
