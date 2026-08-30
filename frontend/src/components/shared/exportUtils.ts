export function csvCell(value: unknown) {
  const textValue = String(value ?? "")
  if (!/[",\n]/.test(textValue)) return textValue
  return `"${textValue.replaceAll('"', '""')}"`
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n")
}

export function downloadFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  downloadFile(filename, "text/csv;charset=utf-8", toCsv(rows))
}
