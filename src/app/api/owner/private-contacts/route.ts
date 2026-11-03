import { NextResponse } from 'next/server'
import { ForbiddenError, UnauthorizedError, toErrorResponse } from '@/lib/auth/account'
import { OwnerLockedError, ownerLockedResponse, requireUnlockedOwner } from '@/lib/auth/owner-unlock'
import { serviceClient } from '@/lib/supabase/service'
import { normalizePrivatePhone, purgeContactsForNumber } from '@/lib/privacy/private-contacts'

function fail(err: unknown, where: string) {
  if (err instanceof OwnerLockedError) return ownerLockedResponse()
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return toErrorResponse(err)
  console.error(`[owner/private-contacts] ${where} failed:`, err)
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}

/** GET → the private list. */
export async function GET() {
  try {
    const { accountId } = await requireUnlockedOwner()
    const { data, error } = await serviceClient()
      .from('private_contacts')
      .select('id, phone, label, created_at')
      .eq('account_id', accountId)
      .order('label', { ascending: true, nullsFirst: false })
    if (error) throw error
    return NextResponse.json({ contacts: data ?? [] })
  } catch (err) {
    return fail(err, 'GET')
  }
}

/**
 * POST { phone, label?, purge? } → add a number. With `purge: true`,
 * any chats already stored for that number are permanently deleted
 * from the CRM (the owner's phone keeps its copy).
 */
export async function POST(request: Request) {
  try {
    const { accountId, userId } = await requireUnlockedOwner()
    const body = await request.json().catch(() => ({}))
    const phone = normalizePrivatePhone(String(body?.phone ?? ''))
    if (!phone) {
      return NextResponse.json(
        { error: 'Enter a valid phone number, e.g. 0772 123 456 or +263 772 123 456.' },
        { status: 400 },
      )
    }
    const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 80) || null : null

    const admin = serviceClient()
    const { data, error } = await admin
      .from('private_contacts')
      .upsert(
        { account_id: accountId, phone, label, created_by: userId },
        { onConflict: 'account_id,phone' },
      )
      .select('id, phone, label, created_at')
      .single()
    if (error) throw error

    let purged = 0
    if (body?.purge === true) {
      purged = await purgeContactsForNumber(admin, accountId, phone)
    }
    return NextResponse.json({ contact: data, purged })
  } catch (err) {
    return fail(err, 'POST')
  }
}

/** DELETE ?id=… → remove a number from the private list (new messages will appear again). */
export async function DELETE(request: Request) {
  try {
    const { accountId } = await requireUnlockedOwner()
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await serviceClient()
      .from('private_contacts')
      .delete()
      .eq('account_id', accountId)
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return fail(err, 'DELETE')
  }
}
