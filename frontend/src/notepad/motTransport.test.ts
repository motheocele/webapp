import { describe, expect, it, vi } from 'vitest'

// Mock networked pieces so we can test mode selection deterministically.
vi.mock('./apiClient', () => ({
  negotiate: vi.fn(),
  postMotRequest: vi.fn(async () => ({ requestId: 'r1' })),
}))

vi.mock('./pubsubClient', () => ({
  connectPubSub: vi.fn(async () => ({ client: {}, stop: async () => {} })),
}))

import { negotiate } from './apiClient'
import { createBestEffortTransport } from './motTransport'

describe('createBestEffortTransport', () => {
  it('defaults to realtime when negotiate succeeds', async () => {
    ;(negotiate as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'wss://example',
      hub: 'mot',
      group: 'session-abc',
    })

    const t = await createBestEffortTransport('abc')
    expect(t.getModeLabel()).toBe('realtime')
  })

  it('falls back to stub when negotiate fails', async () => {
    ;(negotiate as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no api'))

    const t = await createBestEffortTransport('abc')
    expect(t.getModeLabel()).toBe('stub')
  })
})
