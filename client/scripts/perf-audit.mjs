// Local Lighthouse audit against the production build.
//
// The dev server is not a valid measurement target: HMR, unminified modules and
// no chunk splitting make every number worse than what ships. This script boots
// `vite preview` on the built `dist/` and runs Lighthouse (mobile emulation,
// simulated throttling) once per route per run, then reports the median.
//
// Usage:
//   npm run perf                      # build + audit / and /login, 3 runs each
//   npm run perf -- --runs=5          # more runs, same routes
//   npm run perf -- --routes=/,/login,/progress
//   npm run perf -- --assert          # exit 1 when a median misses the budget
//
// Lighthouse is pinned and fetched through npx instead of becoming a
// devDependency: it is a ~300-package tree that never ships and is not needed by
// `npm ci` in CI. Lighthouse 12 is the last line that supports Node 22.18, the
// version CI and Render run.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const OUT_DIR = join(ROOT, 'perf')
const PORT = 4173
const BASE = `http://localhost:${PORT}`
const LIGHTHOUSE = 'lighthouse@12.8.2'

// Google "good" thresholds for a mobile visit. Median of the runs, not a single
// sample: Lighthouse variance on a laptop is easily ±15% on LCP.
const BUDGETS = { lcp: 2500, cls: 0.1, tbt: 200, fcp: 1800, ttfb: 800 }

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const routes = flag('routes', '/,/login')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean)
const runs = Number(flag('runs', '3'))
const shouldAssert = args.includes('--assert')

if (!existsSync(DIST)) {
  console.error('perf-audit: no dist/ — run `npm run build` first (npm run perf does it).')
  process.exit(1)
}
if (!Number.isInteger(runs) || runs < 1) {
  console.error(`perf-audit: --runs must be a positive integer, got "${runs}"`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE)
      if (response.ok) return
    } catch {
      // not up yet
    }
    await sleep(200)
  }
  throw new Error(`vite preview did not answer on ${BASE} within ${timeoutMs}ms`)
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited ${code}\n${stderr.trim()}`))
    })
  })
}

async function lighthouse(url, reportPath) {
  await run('npx', [
    '--yes',
    LIGHTHOUSE,
    url,
    '--quiet',
    '--only-categories=performance',
    '--form-factor=mobile',
    '--throttling-method=simulate',
    '--output=json',
    `--output-path=${reportPath}`,
    '--chrome-flags=--headless=new --no-sandbox',
  ])
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  const audit = (id) => report.audits[id]?.numericValue ?? 0
  return {
    score: Math.round((report.categories.performance?.score ?? 0) * 100),
    lcp: audit('largest-contentful-paint'),
    cls: audit('cumulative-layout-shift'),
    tbt: audit('total-blocking-time'),
    fcp: audit('first-contentful-paint'),
    ttfb: audit('server-response-time'),
  }
}

const preview = spawn(
  process.execPath,
  [join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] },
)
let previewError = ''
preview.stderr.on('data', (chunk) => {
  previewError += chunk
})

const results = []
let failed = false

try {
  await waitForServer()
  for (const route of routes) {
    const url = `${BASE}${route}`
    const samples = []
    for (let index = 0; index < runs; index += 1) {
      const reportPath = join(OUT_DIR, `.lighthouse-${index}.json`)
      process.stdout.write(`  ${route} run ${index + 1}/${runs}\r`)
      samples.push(await lighthouse(url, reportPath))
      rmSync(reportPath, { force: true })
    }
    const medians = {
      score: Math.round(median(samples.map((sample) => sample.score))),
      lcp: Math.round(median(samples.map((sample) => sample.lcp))),
      cls: Number(median(samples.map((sample) => sample.cls)).toFixed(3)),
      tbt: Math.round(median(samples.map((sample) => sample.tbt))),
      fcp: Math.round(median(samples.map((sample) => sample.fcp))),
      ttfb: Math.round(median(samples.map((sample) => sample.ttfb))),
    }
    const missed = Object.entries(BUDGETS)
      .filter(([metric, budget]) => medians[metric] > budget)
      .map(([metric, budget]) => `${metric} ${medians[metric]} > ${budget}`)
    if (missed.length) failed = true
    results.push({ route, runs: samples, median: medians, missed })
    console.log(
      `${route.padEnd(14)} score ${String(medians.score).padStart(3)}  ` +
        `LCP ${String(medians.lcp).padStart(5)}ms  TBT ${String(medians.tbt).padStart(4)}ms  ` +
        `CLS ${String(medians.cls).padStart(5)}  FCP ${String(medians.fcp).padStart(4)}ms  ` +
        `TTFB ${String(medians.ttfb).padStart(3)}ms`,
    )
  }
} finally {
  preview.kill('SIGTERM')
}

const summary = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  runs,
  budgets: BUDGETS,
  routes: results,
}
writeFileSync(join(OUT_DIR, 'latest.json'), `${JSON.stringify(summary, null, 2)}\n`)

for (const result of results) {
  if (result.missed.length)
    console.log(`  ${result.route} over budget: ${result.missed.join(', ')}`)
}
console.log(`perf-audit: ${results.length} route(s) written to client/perf/latest.json`)

if (previewError.trim()) console.error(previewError.trim())
if (shouldAssert && failed) process.exit(1)
