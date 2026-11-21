// axios is stubbed: no network, no quota burn.
import { test, describe, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type {
  OpenCodeConfig,
  OpenCodeMessage,
  OpenCodeResult,
} from '@/modules/ai/infrastructure/opencode-client.ts'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || 'test-key'

type PostCall = { url: string; body: Record<string, unknown>; config: { headers: Record<string, string> } }
type GetCall = { url: string; config: { headers: Record<string, string> } }
type PostImpl = (url: string, body: Record<string, unknown>, config: { headers: Record<string, string> }) => Promise<{ data: unknown }>
type GetImpl = (url: string, config: { headers: Record<string, string> }) => Promise<{ data: unknown }>

const calls: { post: PostCall[]; get: GetCall[] } = { post: [], get: [] }
let postImpl: PostImpl = async () => ({ data: okResponse() })
let getImpl: GetImpl = async () => ({ data: { data: [] } })

const axiosMock = {
  async post(url: string, body: Record<string, unknown>, config: { headers: Record<string, string> }) {
    calls.post.push({ url, body, config })
    return postImpl(url, body, config)
  },
  async get(url: string, config: { headers: Record<string, string> }) {
    calls.get.push({ url, config })
    return getImpl(url, config)
  },
}

// Stub the module before importing the client under test.
let OpenCodeClient: (typeof import('@/modules/ai/infrastructure/opencode-client.ts'))['OpenCodeClient']
let listFreeModels: (typeof import('@/modules/ai/infrastructure/opencode-client.ts'))['listFreeModels']
before(async () => {
  const axios = (await import('axios')).default
  axios.post = axiosMock.post as unknown as typeof axios.post
  axios.get = axiosMock.get as unknown as typeof axios.get
  const mod = await import('@/modules/ai/infrastructure/opencode-client.ts')
  OpenCodeClient = mod.OpenCodeClient
  listFreeModels = mod.listFreeModels
})

function okResponse(content = '{"ok":true}') {
  return {
    id: 'gen-1',
    object: 'chat.completion',
    created: 1,
    model: 'deepseek-v4.1-flash',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }
}

function makeClient(overrides: Partial<OpenCodeConfig> = {}) {
  return new OpenCodeClient({
    apiKey: 'test-key',
    baseUrl: 'https://opencode.ai/inference/openai/v1',
    model: 'deepseek-v4.1-flash',
    timeoutMs: 1000,
    enabled: true,
    temperature: 0.4,
    maxTokens: 700,
    maxRetries: 1,
    retryBaseMs: 1,
    ...overrides,
  })
}

interface FakeAxiosError extends Error {
  isAxiosError: boolean
  response: { status?: number; data: unknown; headers: Record<string, string> }
  code?: string
}

function axiosError(status?: number, extra: Partial<FakeAxiosError> = {}): FakeAxiosError {
  const err = new Error('provider exploded') as FakeAxiosError
  err.isAxiosError = true
  err.response = { status, data: { error: { message: 'oc_sk_SECRETVALUE' } }, headers: {} }
  Object.assign(err, extra)
  return err
}

/** The failure branch, stated because the call site alone does not narrow it. */
function failure(result: OpenCodeResult): Extract<OpenCodeResult, { success: false }> {
  return result as Extract<OpenCodeResult, { success: false }>
}

describe('chat: happy path', () => {
  beforeEach(() => {
    calls.post.length = 0
    postImpl = async () => ({ data: okResponse('hello') })
  })

  test('posts to the chat completions endpoint with the configured model', async () => {
    const result = await makeClient().chat([{ role: 'user', content: 'hi' }])
    assert.equal(result.success, true)
    assert.equal(result.response.choices[0].message.content, 'hello')
    const call = calls.post[0]
    assert.equal(call.url, 'https://opencode.ai/inference/openai/v1/chat/completions')
    assert.equal(call.body.model, 'deepseek-v4.1-flash')
  })

  test('sends the API key only in the Authorization header', async () => {
    await makeClient().chat([{ role: 'user', content: 'hi' }])
    const { config } = calls.post[0]
    assert.equal(config.headers.Authorization, 'Bearer test-key')
    assert.equal(config.headers['User-Agent'], 'PacePilot/1.0')
    const serialized = JSON.stringify(calls.post[0].body)
    assert.equal(serialized.includes('test-key'), false, 'key must not appear in the body')
  })

  test('forwards the session id for routing and prompt caching', async () => {
    await makeClient().chat([{ role: 'user', content: 'hi' }], { sessionId: 'ses_pacepilot_a_2026-01-05' })
    assert.equal(calls.post[0].config.headers['x-opencode-session'], 'ses_pacepilot_a_2026-01-05')
  })

  test('applies configurable temperature and max_tokens, not hardcoded values', async () => {
    await makeClient({ temperature: 0.9, maxTokens: 1234 }).chat([{ role: 'user', content: 'hi' }])
    assert.equal(calls.post[0].body.temperature, 0.9)
    assert.equal(calls.post[0].body.max_tokens, 1234)
  })

  test('per-call options override the instance defaults', async () => {
    await makeClient({ temperature: 0.4 }).chat([{ role: 'user', content: 'hi' }], {
      temperature: 0.1,
      maxTokens: 50,
    })
    assert.equal(calls.post[0].body.temperature, 0.1)
    assert.equal(calls.post[0].body.max_tokens, 50)
  })

  test('omits response_format unless jsonMode is requested', async () => {
    const client = makeClient()
    await client.chat([{ role: 'user', content: 'hi' }])
    assert.equal(calls.post[0].body.response_format, undefined)
    await client.chat([{ role: 'user', content: 'hi' }], { jsonMode: true })
    assert.deepEqual(calls.post[1].body.response_format, { type: 'json_object' })
  })

  test('forwards full multi-turn history', async () => {
    const messages: OpenCodeMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
    ]
    await makeClient().chat(messages)
    assert.deepEqual(calls.post[0].body.messages, messages)
  })
})

describe('chat: guards', () => {
  test('refuses when disabled without touching the network', async () => {
    calls.post.length = 0
    const result = await makeClient({ enabled: false }).chat([{ role: 'user', content: 'x' }])
    assert.equal(result.success, false)
    assert.equal(result.code, 'disabled')
    assert.equal(result.retryable, false)
    assert.equal(calls.post.length, 0)
  })

  test('refuses when the API key is missing', async () => {
    calls.post.length = 0
    const result = await makeClient({ apiKey: '' }).chat([{ role: 'user', content: 'x' }])
    assert.equal(result.success, false)
    assert.equal(result.code, 'no_api_key')
    assert.equal(calls.post.length, 0)
  })
})

describe('chat: provider errors', () => {
  beforeEach(() => {
    calls.post.length = 0
  })

  test('maps 429 to rate_limited', async () => {
    postImpl = async () => { throw axiosError(429) }
    const result = await makeClient({ maxRetries: 0 }).chat([{ role: 'user', content: 'x' }])
    assert.equal(result.success, false)
    assert.equal(result.code, 'rate_limited')
    assert.equal(result.retryable, true)
  })

  test('maps 401 to auth_failed and does not retry', async () => {
    postImpl = async () => { throw axiosError(401) }
    const result = failure(await makeClient({ maxRetries: 3 }).chat([{ role: 'user', content: 'x' }]))
    assert.equal(result.code, 'auth_failed')
    assert.equal(result.retryable, false)
    assert.equal(calls.post.length, 1, 'auth failures must not be retried')
  })

  test('maps 402 to payment_required and does not retry', async () => {
    postImpl = async () => { throw axiosError(402) }
    const result = failure(await makeClient({ maxRetries: 3 }).chat([{ role: 'user', content: 'x' }]))
    assert.equal(result.code, 'payment_required')
    assert.equal(calls.post.length, 1)
  })

  test('maps 404 to model_unavailable so the fallback path can engage', async () => {
    postImpl = async () => { throw axiosError(404) }
    const result = failure(await makeClient({ maxRetries: 0 }).chat([{ role: 'user', content: 'x' }]))
    assert.equal(result.code, 'model_unavailable')
  })

  test('maps a timeout', async () => {
    postImpl = async () => { throw axiosError(undefined, { code: 'ECONNABORTED' }) }
    const result = failure(await makeClient({ maxRetries: 0 }).chat([{ role: 'user', content: 'x' }]))
    assert.equal(result.code, 'timeout')
  })

  test('never leaks the provider message or the key into the error', async () => {
    postImpl = async () => { throw axiosError(400) }
    const result = failure(await makeClient().chat([{ role: 'user', content: 'x' }]))
    assert.equal(result.error.message.includes('SECRETVALUE'), false)
    assert.equal(result.error.message.includes('test-key'), false)
  })
})

describe('chat: bounded retry', () => {
  beforeEach(() => {
    calls.post.length = 0
  })

  test('retries a 429 once then succeeds', async () => {
    let attempt = 0
    postImpl = async () => {
      attempt++
      if (attempt === 1) throw axiosError(429)
      return { data: okResponse('recovered') }
    }
    const result = await makeClient({ maxRetries: 1 }).chat([{ role: 'user', content: 'x' }])
    assert.equal(result.success, true)
    assert.equal(result.response.choices[0].message.content, 'recovered')
    assert.equal(calls.post.length, 2)
  })

  test('gives up after the configured attempt budget — never a loop', async () => {
    postImpl = async () => { throw axiosError(503) }
    const result = await makeClient({ maxRetries: 2 }).chat([{ role: 'user', content: 'x' }])
    assert.equal(result.success, false)
    assert.equal(result.code, 'server_error')
    assert.equal(calls.post.length, 3, '1 initial + 2 retries, then stop')
  })

  test('maxRetries=0 means a single attempt', async () => {
    postImpl = async () => { throw axiosError(429) }
    await makeClient({ maxRetries: 0 }).chat([{ role: 'user', content: 'x' }])
    assert.equal(calls.post.length, 1)
  })

  test('honours Retry-After instead of the exponential base', async () => {
    const err = axiosError(429)
    err.response.headers['retry-after'] = '2'
    postImpl = async () => { throw err }
    const started = Date.now()
    await makeClient({ maxRetries: 1, retryBaseMs: 1 }).chat([{ role: 'user', content: 'x' }])
    assert.ok(Date.now() - started >= 1900, 'waited at least the advertised 2s')
  })
})

describe('listFreeModels', () => {
  test('returns only zero-priced ids that support structured output', async () => {
    getImpl = async () => ({
      data: {
        data: [
          { id: 'free-model', limit: { context: 1000 }, cost: { text: { input: { price: 0 }, output: { price: 0 } } }, capabilities: { structured_output: true } },
          { id: 'paid-model', limit: { context: 1000 }, cost: { text: { input: { price: 0.3 }, output: { price: 1.2 } } }, capabilities: { structured_output: true } },
          { id: 'no-structured', limit: { context: 1000 }, cost: { text: { input: { price: 0 }, output: { price: 0 } } }, capabilities: {} },
        ],
      },
    })
    const free = await listFreeModels({ baseUrl: 'https://opencode.ai/inference/openai/v1', apiKey: 'k', timeoutMs: 500 })
    assert.deepEqual(free, [
      { id: 'free-model', contextLength: 1000, supportsJsonMode: true },
      { id: 'no-structured', contextLength: 1000, supportsJsonMode: false },
    ])
  })

  test('survives a catalog response with no data array', async () => {
    getImpl = async () => ({ data: {} })
    assert.deepEqual(await listFreeModels({ baseUrl: 'x', apiKey: '', timeoutMs: 500 }), [])
  })
})
