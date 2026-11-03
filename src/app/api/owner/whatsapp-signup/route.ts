import { NextResponse } from 'next/server'
import { ForbiddenError, UnauthorizedError, toErrorResponse } from '@/lib/auth/account'
import { OwnerLockedError, ownerLockedResponse, requireUnlockedOwner } from '@/lib/auth/owner-unlock'
import { serviceClient } from '@/lib/supabase/service'
import {
  listWabaPhoneNumbers,
  registerPhoneNumber,
  subscribeWabaToApp,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import { isNumericMetaId, phoneNumberBelongsToWaba } from '@/lib/whatsapp/waba-pairing'
import { decrypt, encrypt } from '@/lib/whatsapp/encryption'
import {
  EmbeddedSignupError,
  exchangeCodeForToken,
  randomPin,
  randomVerifyToken,
  tokenExpiry,
} from '@/lib/whatsapp/embedded-signup'

export const maxDuration = 60

function webhookUrl(request: Request): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  return `${origin.replace(/\/$/, '')}/api/whatsapp/webhook`
}

/**
 * GET → what the owner needs for Meta's webhook screen: the callback URL
 * and the verify token (decrypted; owner-only and password-unlocked).
 */
export async function GET(request: Request) {
  try {
    const { accountId } = await requireUnlockedOwner()
    const { data } = await serviceClient()
      .from('whatsapp_config')
      .select('verify_token, phone_number_id, onboarding_method, token_expires_at, status')
      .eq('account_id', accountId)
      .maybeSingle()
    let verifyToken: string | null = null
    if (data?.verify_token) {
      try {
        verifyToken = decrypt(data.verify_token)
      } catch {
        verifyToken = null
      }
    }
    return NextResponse.json({
      webhook_url: webhookUrl(request),
      verify_token: verifyToken,
      connected: data?.status === 'connected',
      onboarding_method: data?.onboarding_method ?? null,
      token_expires_at: data?.token_expires_at ?? null,
    })
  } catch (err) {
    if (err instanceof OwnerLockedError) return ownerLockedResponse()
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return toErrorResponse(err)
    console.error('[owner/whatsapp-signup] GET failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST { code, waba_id, phone_number_id, coexistence }
 *
 * Finishes Embedded Signup: exchanges the code for a business token,
 * checks the number belongs to the WABA, subscribes the WABA to this
 * app's webhook and stores the (encrypted) credentials.
 *
 * Coexistence numbers are already live in the WhatsApp Business app, so
 * they must NOT be re-registered — calling /register would take the
 * number away from the phone. History / contact sync is intentionally
 * not requested: the owner chose not to import old chats.
 */
export async function POST(request: Request) {
  try {
    const { accountId, userId } = await requireUnlockedOwner()
    const body = await request.json().catch(() => ({}))
    const code = typeof body?.code === 'string' ? body.code : ''
    const wabaId = String(body?.waba_id ?? '')
    let phoneNumberId = String(body?.phone_number_id ?? '')
    const coexistence = body?.coexistence === true

    if (!code) return NextResponse.json({ error: 'Signup did not return a code. Please try again.' }, { status: 400 })
    if (!isNumericMetaId(wabaId)) {
      return NextResponse.json(
        { error: 'Signup did not return a WhatsApp account. Please try again.' },
        { status: 400 },
      )
    }

    const admin = serviceClient()
    const accessToken = await exchangeCodeForToken(code)
    const wabaNumbers = await listWabaPhoneNumbers({ wabaId, accessToken })

    // Some signup variants report only the WABA; with a single number
    // under it there is no ambiguity about which one was connected.
    if (!isNumericMetaId(phoneNumberId)) {
      if (wabaNumbers.length === 1) phoneNumberId = wabaNumbers[0].id
      else {
        return NextResponse.json(
          { error: 'Signup did not say which phone number was connected. Please try again.' },
          { status: 400 },
        )
      }
    }

    // One number ↔ one CRM account (the webhook routes on phone_number_id).
    const { data: claimed } = await admin
      .from('whatsapp_config')
      .select('account_id')
      .eq('phone_number_id', phoneNumberId)
      .neq('account_id', accountId)
      .maybeSingle()
    if (claimed) {
      return NextResponse.json(
        { error: 'This WhatsApp number is already connected to another workspace.' },
        { status: 409 },
      )
    }

    const phoneInfo = await verifyPhoneNumber({ phoneNumberId, accessToken })
    if (!phoneNumberBelongsToWaba(wabaNumbers, phoneNumberId)) {
      return NextResponse.json(
        { error: 'Meta returned a phone number that is not part of the selected WhatsApp account.' },
        { status: 400 },
      )
    }

    await subscribeWabaToApp({ wabaId, accessToken })

    let registeredAt: string | null = new Date().toISOString()
    let registrationError: string | null = null
    if (!coexistence) {
      // Brand-new Cloud API number: it needs /register with a 2FA PIN.
      try {
        await registerPhoneNumber({ phoneNumberId, accessToken, pin: randomPin() })
      } catch (err) {
        registeredAt = null
        registrationError = err instanceof Error ? err.message : 'Registration failed'
        console.error('[owner/whatsapp-signup] register failed:', registrationError)
      }
    }

    const expiresAt = await tokenExpiry(accessToken)

    const { data: existing } = await admin
      .from('whatsapp_config')
      .select('id, verify_token')
      .eq('account_id', accountId)
      .maybeSingle()

    let plainVerifyToken: string | null = null
    let encryptedVerifyToken: string | null = existing?.verify_token ?? null
    if (encryptedVerifyToken) {
      try {
        plainVerifyToken = decrypt(encryptedVerifyToken)
      } catch {
        encryptedVerifyToken = null
      }
    }
    if (!encryptedVerifyToken) {
      plainVerifyToken = randomVerifyToken()
      encryptedVerifyToken = encrypt(plainVerifyToken)
    }

    const row = {
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: encrypt(accessToken),
      verify_token: encryptedVerifyToken,
      status: registrationError ? 'disconnected' : 'connected',
      connected_at: registrationError ? null : new Date().toISOString(),
      registered_at: registeredAt,
      subscribed_apps_at: new Date().toISOString(),
      last_registration_error: registrationError,
      onboarding_method: coexistence ? 'coexistence' : 'embedded_signup',
      token_expires_at: expiresAt ? expiresAt.toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const { error: saveErr } = existing
      ? await admin.from('whatsapp_config').update(row).eq('account_id', accountId)
      : await admin.from('whatsapp_config').insert({ account_id: accountId, user_id: userId, ...row })
    if (saveErr) throw saveErr

    return NextResponse.json({
      success: !registrationError,
      coexistence,
      phone_info: phoneInfo,
      registration_error: registrationError,
      token_expires_at: row.token_expires_at,
      webhook_url: webhookUrl(request),
      verify_token: plainVerifyToken,
    })
  } catch (err) {
    if (err instanceof OwnerLockedError) return ownerLockedResponse()
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return toErrorResponse(err)
    if (err instanceof EmbeddedSignupError) {
      console.error('[owner/whatsapp-signup] Meta step failed:', err.step, err.message, err.detail)
      return NextResponse.json({ error: `Meta (${err.step}): ${err.message}` }, { status: 502 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[owner/whatsapp-signup] POST failed:', err)
    return NextResponse.json({ error: `Could not finish connecting: ${message}` }, { status: 500 })
  }
}
