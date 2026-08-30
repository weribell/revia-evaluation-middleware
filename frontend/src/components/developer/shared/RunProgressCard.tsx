export function RunProgressCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[9rem] items-baseline justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <div className="truncate text-xs font-medium leading-tight text-muted-foreground">{label}</div>
      <div className="shrink-0 text-sm font-semibold leading-tight text-foreground">{value}</div>
    </div>
  )
}
