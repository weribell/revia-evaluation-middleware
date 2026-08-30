export type LinkifiedTextPart =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string }

const urlPattern = /https?:\/\/[^\s<>"']+/g
const trailingPunctuationPattern = /[),.;:!?]+$/

export function splitTextIntoLinkParts(text: string): LinkifiedTextPart[] {
  const parts: LinkifiedTextPart[] = []
  let lastIndex = 0

  for (const match of text.matchAll(urlPattern)) {
    const rawUrl = match[0]
    const matchIndex = match.index ?? 0
    const trailingPunctuation = rawUrl.match(trailingPunctuationPattern)?.[0] || ""
    const url = trailingPunctuation ? rawUrl.slice(0, -trailingPunctuation.length) : rawUrl
    const urlEnd = matchIndex + url.length

    if (matchIndex > lastIndex) {
      parts.push({ kind: "text", text: text.slice(lastIndex, matchIndex) })
    }
    if (url) {
      parts.push({ kind: "link", text: url })
    }
    if (trailingPunctuation) {
      parts.push({ kind: "text", text: trailingPunctuation })
    }
    lastIndex = matchIndex + rawUrl.length
    if (urlEnd > lastIndex) {
      lastIndex = urlEnd
    }
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", text: text.slice(lastIndex) })
  }

  return parts.length ? parts : [{ kind: "text", text }]
}
