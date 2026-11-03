import { NextResponse } from 'next/server'
import { ForbiddenError, UnauthorizedError, toErrorResponse } from '@/lib/auth/account'
import { OwnerLockedError, ownerLockedResponse, requireUnlockedOwner } from '@/lib/auth/owner-unlock'
import { serviceClient } from '@/lib/supabase/service'

/**
 * DELETE /api/owner/conversations/:id[?contact=1]
 *
 * Owner-only, password-unlocked. Permanently removes a chat (and its
 * messages) from the CRM. With `contact=1` the contact card goes too.
 * Nothing changes on the owner's phone.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { accountId } = await requireUnlockedOwner()
    const { id } = await params
    const alsoContact = new URL(request.url).searchParams.get('contact') === '1'
    const admin = serviceClient()

    const { data: conv, error: findErr } = await admin
      .from('conversations')
      .select('id, contact_id')
      .eq('account_id', accountId)
      .eq('id', id)
      .maybeSingle()
    if (findErr) throw findErr
    if (!conv) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    if (alsoContact && conv.contact_id) {
      const { error } = await admin
        .from('contacts')
        .delete()
        .eq('account_id', accountId)
        .eq('id', conv.contact_id)
      if (error) throw error
    } else {
      const { error } = await admin
        .from('conversations')
        .delete()
        .eq('account_id', accountId)
        .eq('id', id)
      if (error) throw error
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof OwnerLockedError) return ownerLockedResponse()
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return toErrorResponse(err)
    console.error('[owner/conversations] DELETE failed:', err)
    return NextResponse.json({ error: 'Could not delete the chat.' }, { status: 500 })
  }
}
