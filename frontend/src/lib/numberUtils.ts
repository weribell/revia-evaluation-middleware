// Shared rounding for dashboard figures. Rates, averages and person-hours are
// all reported to one decimal, so the rule lives in one place rather than being
// respelled per dashboard model.
export function roundOne(value: number) {
  return Math.round(value * 10) / 10
}
