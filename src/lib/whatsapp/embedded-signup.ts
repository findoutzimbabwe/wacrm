/**
 * Server-side helpers for Meta's WhatsApp Embedded Signup, including
 * the WhatsApp Business app "coexistence" onboarding (the number keeps
 * working in the Business app on the owner's phone).
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

export function metaAppId(): string | null {
  return process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID || null
}

export function embeddedSignupConfigId(): string | null {
  return process.env.NEXT_PUBLIC_META_ES_CONFIG_ID || null
}

/** META_APP_SECRET may list several secrets (multi-app setups); the first belongs to this app. */
export function primaryAppSecret(): string | null {
  const raw = process.env.META_APP_SECRET
  if (!raw) return null
  const first = raw.split(',').map((s) => s.trim()).find(Boolean)
  return first ?? null
}

export class EmbeddedSignupError extends Error {
  constructor(message: string, readonly step: string, readonly detail?: unknown) {
    super(message)
    this.name = 'EmbeddedSignupError'
  }
}

async function graphJson(url: string, step: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) {
    const msg = json?.error?.message || `Meta returned HTTP ${res.status}`
    throw new EmbeddedSignupError(msg, step, json?.error)
  }
  return json
}

/** Swap the 30-second code from FB.login for a business access token. */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const appId = metaAppId()
  const secret = primaryAppSecret()
  if (!appId || !secret) {
    throw new EmbeddedSignupError(
      'NEXT_PUBLIC_META_APP_ID and META_APP_SECRET must be set on the server.',
      'config',
    )
  }
  const qs = new URLSearchParams({ client_id: appId, client_secret: secret, code })
  const json = await graphJson(`${GRAPH}/oauth/access_token?${qs}`, 'exchange_code')
  if (!json.access_token) throw new EmbeddedSignupError('Meta returned no access token.', 'exchange_code')
  return json.access_token as string
}

/** When the token expires (null = never / unknown). */
export async function tokenExpiry(token: string): Promise<Date | null> {
  const appId = metaAppId()
  const secret = primaryAppSecret()
  if (!appId || !secret) return null
  try {
    const qs = new URLSearchParams({ input_token: token, access_token: `${appId}|${secret}` })
    const json = await graphJson(`${GRAPH}/debug_token?${qs}`, 'debug_token')
    const exp = Number(json?.data?.expires_at ?? 0)
    return exp > 0 ? new Date(exp * 1000) : null
  } catch (err) {
    console.warn('[embedded-signup] debug_token failed:', err)
    return null
  }
}

/** Six random digits for the two-step-verification PIN of a brand-new (non-coexistence) number. */
export function randomPin(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

/** A random webhook verify token for Meta's webhook handshake. */
export function randomVerifyToken(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}
