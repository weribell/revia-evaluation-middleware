export function formatCurrency(value: number) {
  const options =
    value > 0 && value < 1
      ? { maximumFractionDigits: 2, minimumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }
  return `€${value.toLocaleString("en-US", options)}`
}

export function formatMoney(value: number, currency: "EUR" | "USD") {
  if (currency === "EUR") return formatCurrency(value)
  const options =
    value > 0 && value < 1
      ? { maximumFractionDigits: 6, minimumFractionDigits: 2 }
      : Number.isInteger(value)
        ? { maximumFractionDigits: 0 }
        : { maximumFractionDigits: 2, minimumFractionDigits: 2 }
  return `$${value.toLocaleString("en-US", options)}`
}

export function formatHours(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} h`
}
