// Self-host the MapLibre ESM build and its worker so the worker is same-origin.
// A CDN-hosted worker is loaded through a blob module that Safari refuses to
// import (`WebKitBlobResource error 1`), which leaves the mobile map blank.
// Copying from the installed package keeps both files on the version in
// package-lock.json without adding ~1.6 MB to an application chunk.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = join(here, '..', 'node_modules', 'maplibre-gl', 'dist')
const destination = join(here, '..', 'public', 'vendor', 'maplibre')
const files = ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs']

mkdirSync(destination, { recursive: true })
for (const file of files) {
  copyFileSync(join(source, file), join(destination, file))
}
