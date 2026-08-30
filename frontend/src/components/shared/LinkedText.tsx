import { splitTextIntoLinkParts } from "./linkifyText"

export function LinkedText({ text }: { text: string }) {
  return splitTextIntoLinkParts(text).map((part, index) =>
    part.kind === "link" ? (
      <a
        key={`${part.text}-${index}`}
        className="break-all font-medium text-primary underline underline-offset-4"
        href={part.text}
        target="_blank"
        rel="noreferrer"
      >
        {part.text}
      </a>
    ) : (
      <span key={`${index}-${part.text}`}>{part.text}</span>
    ),
  )
}
