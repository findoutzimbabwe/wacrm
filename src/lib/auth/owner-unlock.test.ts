import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/lib/auth/account', () => ({ requireRole: vi.fn() }))

import { mintUnlockToken, verifyUnlockToken, OWNER_UNLOCK_TTL_SECONDS } from './owner-unlock'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
})

describe('owner unlock token', () => {
  const now = 1_700_000_000_000
  it('verifies for the same user within the window', () => {
    const t = mintUnlockToken('user-1', now)
    expect(verifyUnlockToken(t, 'user-1', now + 60_000)).toBe(
      Math.floor(now / 1000) + OWNER_UNLOCK_TTL_SECONDS,
    )
  })
  it('rejects another user, an expired token, and tampering', () => {
    const t = mintUnlockToken('user-1', now)
    expect(verifyUnlockToken(t, 'user-2', now)).toBeNull()
    expect(verifyUnlockToken(t, 'user-1', now + (OWNER_UNLOCK_TTL_SECONDS + 1) * 1000)).toBeNull()
    const [uid, exp, sig] = t.split('.')
    expect(verifyUnlockToken(`${uid}.${Number(exp) + 9999}.${sig}`, 'user-1', now)).toBeNull()
    expect(verifyUnlockToken(undefined, 'user-1', now)).toBeNull()
  })
})
