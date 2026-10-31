import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

import { createApp } from '@/app.ts'

async function fixture(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'pacepilot-static-'))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>shell</title>')
  await writeFile(path.join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n')
  await mkdir(path.join(dir, '.well-known'), { recursive: true })
  await writeFile(
    path.join(dir, '.well-known', 'security.txt'),
    'Contact: mailto:security@pacepilot.pt\nExpires: 2027-10-31T00:00:00.000Z\n',
  )
  return dir
}

test('SPA shell is served for known routes only and public files keep their type', async () => {
  const staticDir = await fixture()
  const app = createApp({ staticDir })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    const known = await fetch(`${base}/settings`)
    assert.equal(known.status, 200)
    assert.match(known.headers.get('content-type') ?? '', /text\/html/)

    const deep = await fetch(`${base}/activities/abc`)
    assert.equal(deep.status, 200)

    const unknown = await fetch(`${base}/.git/config`)
    assert.equal(unknown.status, 404)
    assert.deepEqual(await unknown.json(), { error: 'Not found' })

    const robots = await fetch(`${base}/robots.txt`)
    assert.equal(robots.status, 200)
    assert.match(robots.headers.get('content-type') ?? '', /text\/plain/)
    assert.match(await robots.text(), /User-agent:/)

    const security = await fetch(`${base}/.well-known/security.txt`)
    assert.equal(security.status, 200)
    assert.match(await security.text(), /^Contact: mailto:/m)
  } finally {
    server.close()
    await rm(staticDir, { recursive: true, force: true })
  }
})
