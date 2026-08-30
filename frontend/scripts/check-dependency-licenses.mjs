import { existsSync, readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

const storeUrl = new URL("../node_modules/.pnpm/", import.meta.url)

if (!existsSync(storeUrl)) {
  console.error("Dependency store not found. Run 'pnpm install --frozen-lockfile' first.")
  process.exit(1)
}

function packageDirectories(nodeModulesUrl) {
  if (!existsSync(nodeModulesUrl)) return []

  return readdirSync(nodeModulesUrl, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) return []
    if (!entry.name.startsWith("@")) return [new URL(`${entry.name}/`, nodeModulesUrl)]

    const scopeUrl = new URL(`${entry.name}/`, nodeModulesUrl)
    return readdirSync(scopeUrl, { withFileTypes: true })
      .filter((packageEntry) => packageEntry.isDirectory() || packageEntry.isSymbolicLink())
      .map((packageEntry) => new URL(`${packageEntry.name}/`, scopeUrl))
  })
}

function licenseExpression(packageJson) {
  if (typeof packageJson.license === "string" && packageJson.license.trim()) {
    return packageJson.license.trim()
  }
  if (packageJson.license && typeof packageJson.license.type === "string") {
    return packageJson.license.type.trim()
  }
  if (Array.isArray(packageJson.licenses)) {
    const values = packageJson.licenses
      .map((license) => (typeof license === "string" ? license : license?.type))
      .filter(Boolean)
    if (values.length) return values.join(" OR ")
  }
  return "UNKNOWN"
}

const packages = new Map()

for (const storeEntry of readdirSync(storeUrl, { withFileTypes: true })) {
  if (!storeEntry.isDirectory()) continue
  const nodeModulesUrl = new URL(`${storeEntry.name}/node_modules/`, storeUrl)

  for (const packageUrl of packageDirectories(nodeModulesUrl)) {
    const manifestUrl = new URL("package.json", packageUrl)
    if (!existsSync(manifestUrl)) continue

    const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"))
    if (!manifest.name || !manifest.version) continue
    const id = `${manifest.name}@${manifest.version}`
    packages.set(id, {
      id,
      license: licenseExpression(manifest),
      manifest: fileURLToPath(manifestUrl),
    })
  }
}

const inventory = [...packages.values()].sort((left, right) => left.id.localeCompare(right.id))
const byLicense = inventory.reduce((counts, item) => {
  counts.set(item.license, (counts.get(item.license) || 0) + 1)
  return counts
}, new Map())

for (const [license, count] of [...byLicense].sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`${license}: ${count}`)
}
console.log(`TOTAL: ${inventory.length}`)

if (process.argv.includes("--details")) {
  console.log("")
  for (const item of inventory) console.log(`${item.id}\t${item.license}`)
}

const unknown = inventory.filter((item) => item.license === "UNKNOWN")
if (unknown.length) {
  console.error("")
  console.error("Packages without a declared license:")
  for (const item of unknown) console.error(`${item.id}: ${item.manifest}`)
  process.exit(1)
}
