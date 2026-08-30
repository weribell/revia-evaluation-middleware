export type SourceExcerptBlock = {
  kind: "heading" | "paragraph" | "bullet"
  text: string
}

const bulletPrefix = /^(?:[-*]\s+|\d+[.)]\s+)/

export function formatSourceExcerptBlocks(value: string): SourceExcerptBlock[] {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => {
      if (bulletPrefix.test(line)) {
        return { kind: "bullet", text: line.replace(bulletPrefix, "").trim() }
      }
      if (looksLikeSourceHeading(line)) {
        return { kind: "heading", text: line }
      }
      return { kind: "paragraph", text: line }
    })
}

function looksLikeSourceHeading(line: string) {
  if (line.length > 84) return false
  if (/^[a-zäöüß]/.test(line)) return false
  if (/[.!?]$/.test(line)) return false
  return true
}
