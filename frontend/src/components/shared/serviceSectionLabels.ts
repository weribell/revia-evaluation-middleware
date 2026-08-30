import type { Language } from "@/types"

export const serviceSectionLabels: Record<string, string> = {
  required_documents: "Required documents",
  fees: "Fees",
  requirements: "Requirements",
  processing_time: "Processing time",
  responsibility_notes: "Responsible authority",
  forms: "Forms",
  online_abwicklung: "Online processing",
  additional_information: "Additional information",
  full_text: "Official service text",
}

const compactGermanServiceSectionLabels: Record<string, string> = {
  required_documents: "Unterlagen",
  fees: "Gebühren",
  requirements: "Voraussetzungen",
  processing_time: "Bearbeitungszeit",
  responsibility_notes: "Zuständigkeit",
  forms: "Formulare",
  online_abwicklung: "Online-Abwicklung",
  additional_information: "Weitere Informationen",
  full_text: "Offizieller Servicetext",
}

export function serviceSectionLabel(language: Language, sectionName: string) {
  const labels = language === "de" ? compactGermanServiceSectionLabels : serviceSectionLabels
  return labels[sectionName] || sectionName.replaceAll("_", " ")
}
