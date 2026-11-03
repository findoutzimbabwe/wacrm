import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { ForbiddenError, UnauthorizedError, toErrorResponse } from '@/lib/auth/account'
import {
  OWNER_UNLOCK_COOKIE,
  clearUnlockCookie,
  requireOwner,
  setUnlockCookie,
  verifyUnlockToken,
} from '@/lib/auth/owner-unlock'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/** GET → { unlocked, unlocked_until } for the owner. */
export async function GET() {
  try {
    const { userId } = await requireOwner()
    const store = await cookies()
    const exp = verifyUnlockToken(store.get(OWNER_UNLOCK_COOKIE)?.value, userId)
    return NextResponse.json({ unlocked: !!exp, unlocked_until: exp ? exp * 1000 : null })
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return toErrorResponse(err)
    console.error('[owner/unlock] GET failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST { password } → re-checks the owner's password, then unlocks for 10 minutes. */
export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireOwner()

    // 5 attempts per 5 minutes per owner — enough for typos, useless for guessing.
    const limit = checkRateLimit(`owner-unlock:${userId}`, { limit: 5, windowMs: 5 * 60_000 })
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => ({}))
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!password) {
      return NextResponse.json({ error: 'Enter your password.' }, { status: 400 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 })
    }

    // Verify with a throwaway client so the check never touches the
    // browser's own session cookies.
    const verifier = createPlainClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data, error } = await verifier.auth.signInWithPassword({ email: user.email, password })
    if (error || data.user?.id !== userId) {
      return NextResponse.json({ error: 'That password is not correct.' }, { status: 401 })
    }
    // Revoke only the throwaway session we just created.
    await verifier.auth.signOut({ scope: 'local' }).catch(() => {})

    const exp = await setUnlockCookie(userId)
    return NextResponse.json({ unlocked: true, unlocked_until: exp * 1000 })
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return toErrorResponse(err)
    console.error('[owner/unlock] POST failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE → lock again immediately. */
export async function DELETE() {
  try {
    await requireOwner()
    await clearUnlockCookie()
    return NextResponse.json({ unlocked: false })
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return toErrorResponse(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
