// Guard for the Vite "chunks larger than 500 kB" warning: the app shell used to
// ship as one 805 kB chunk, and this fails the build if a single minified chunk
// crosses the budget again instead of printing a warning nobody reads.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

// Matches Vite's own default warning threshold (500 kB, decimal like Vite reports
// it); the largest chunk today is ~175 kB.
const BUDGET_BYTES = 500_000
const TOP_COUNT = 5

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const assets = join(dist, 'assets')

const kib = (bytes) => `${(bytes / 1000).toFixed(2)} kB`

let chunks
try {
  chunks = readdirSync(assets)
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
      const path = join(assets, name)
      const source = readFileSync(path)
      return { name, bytes: statSync(path).size, gzip: gzipSync(source).length }
    })
    .sort((a, b) => b.bytes - a.bytes)
} catch {
  console.error(`check-bundle-size: no built chunks in ${assets} — run the build first.`)
  process.exit(1)
}

if (chunks.length === 0) {
  console.error(`check-bundle-size: no .js chunks in ${assets} — nothing was built.`)
  process.exit(1)
}

// Chunks referenced from index.html are the ones every visitor downloads before
// the app is interactive, so their total is worth seeing next to the per-chunk cap.
let eagerBytes = 0
let eagerCount = 0
try {
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  const referenced = new Set(
    [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+\.js)"/g)].map((match) => match[1]),
  )
  for (const url of referenced) {
    try {
      eagerBytes += statSync(join(dist, url)).size
      eagerCount += 1
    } catch {
      console.warn(`check-bundle-size: index.html references missing chunk ${url}`)
    }
  }
} catch {
  console.error(`check-bundle-size: ${join(dist, 'index.html')} is missing — run the build first.`)
  process.exit(1)
}

console.log(`bundle size check — budget ${kib(BUDGET_BYTES)} per chunk, ${chunks.length} chunks`)
for (const { name, bytes, gzip } of chunks.slice(0, TOP_COUNT)) {
  console.log(`  ${kib(bytes).padStart(10)} (${kib(gzip)} gz)  ${name}`)
}
console.log(`  ${kib(eagerBytes).padStart(10)} total        entry graph (${eagerCount} chunks)`)

const over = chunks.filter((chunk) => chunk.bytes > BUDGET_BYTES)
if (over.length > 0) {
  console.error('')
  for (const { name, bytes } of over) {
    console.error(
      `check-bundle-size: ${name} is ${kib(bytes)}, over the ${kib(BUDGET_BYTES)} budget`,
    )
  }
  console.error('Split it (route-level dynamic import, or a manualChunks group in vite.config.js)')
  console.error('or raise BUDGET_BYTES with a reason.')
  process.exit(1)
}
