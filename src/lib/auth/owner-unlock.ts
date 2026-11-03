import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { requireRole, type AccountContext } from '@/lib/auth/account'

/**
 * "Extra lock" for owner-only controls (private contacts, deleting
 * chats, connecting the WhatsApp number).
 *
 * Being signed in as the owner is not enough: the owner must re-enter
 * their password, which mints a short-lived, HMAC-signed, httpOnly
 * cookie scoped to /api/owner. A laptop left signed in near staff can't
 * be used to change these settings once the unlock window expires.
 */

export const OWNER_UNLOCK_COOKIE = 'wacrm_owner_unlock'
export const OWNER_UNLOCK_PATH = '/api/owner'
export const OWNER_UNLOCK_TTL_SECONDS = 10 * 60

export class OwnerLockedError extends Error {
  constructor() {
    super('Re-enter your password to use owner controls.')
    this.name = 'OwnerLockedError'
  }
}

function signingKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) throw new Error('ENCRYPTION_KEY is not set')
  // Domain-separate from the token-encryption use of the same secret.
  return createHmac('sha256', secret).update('owner-unlock-v1').digest()
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url')
}

export function mintUnlockToken(userId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + OWNER_UNLOCK_TTL_SECONDS
  const payload = `${userId}.${exp}`
  return `${payload}.${sign(payload)}`
}

/** Returns the expiry (unix seconds) when valid for `userId`, else null. */
export function verifyUnlockToken(
  token: string | undefined | null,
  userId: string,
  now = Date.now(),
): number | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [uid, expRaw, sig] = parts
  if (uid !== userId) return null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null
  const expected = Buffer.from(sign(`${uid}.${expRaw}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return exp
}

export async function setUnlockCookie(userId: string): Promise<number> {
  const token = mintUnlockToken(userId)
  const store = await cookies()
  store.set(OWNER_UNLOCK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: OWNER_UNLOCK_PATH,
    maxAge: OWNER_UNLOCK_TTL_SECONDS,
  })
  return Number(token.split('.')[1])
}

export async function clearUnlockCookie(): Promise<void> {
  const store = await cookies()
  store.set(OWNER_UNLOCK_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: OWNER_UNLOCK_PATH,
    maxAge: 0,
  })
}

/** Owner role check only (no password re-check). */
export async function requireOwner(): Promise<AccountContext> {
  return requireRole('owner')
}

/** Owner role AND a live password unlock. Throws OwnerLockedError when locked. */
export async function requireUnlockedOwner(): Promise<AccountContext & { unlockedUntil: number }> {
  const ctx = await requireRole('owner')
  const store = await cookies()
  const exp = verifyUnlockToken(store.get(OWNER_UNLOCK_COOKIE)?.value, ctx.userId)
  if (!exp) throw new OwnerLockedError()
  return { ...ctx, unlockedUntil: exp }
}

export function ownerLockedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Re-enter your password to use owner controls.', unlock_required: true },
    { status: 403 },
  )
}
