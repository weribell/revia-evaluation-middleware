export const productBrand = {
  name: "REVIA",
  expansion: "Review and Evaluation Infrastructure for AI Answers",
  expansionLines: ["Review and Evaluation", "Infrastructure for AI Answers"],
  logoPath: "/revia-wordmark.png",
  description:
    "A flexible middleware for evaluating AI-generated answers with evidence traces, automated judges, human review, and disagreement analysis.",
} as const

export function buildDashboardBrandContext(input: {
  title: string
  description?: string
}) {
  return {
    productName: productBrand.name,
    productSubtitle: productBrand.expansion,
    productSubtitleLines: productBrand.expansionLines,
    productLogoPath: productBrand.logoPath,
    workspaceTitle: input.title,
  }
}
