import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'

/**
 * Private contacts — numbers whose WhatsApp traffic must never reach
 * the CRM (see migration 060). Everything here runs with the
 * service-role client; callers are responsible for the owner check.
 */

/** Default country calling code used when a local number (leading 0) is typed. */
export const DEFAULT_COUNTRY_CODE = process.env.PRIVATE_CONTACTS_COUNTRY_CODE || '263'

/**
 * Turn whatever the owner typed into digits-only international format.
 *   "+263 77 923 6937" → "263779236937"
 *   "0779236937"       → "263779236937"  (local Zimbabwe format)
 *   "00263779236937"   → "263779236937"
 * Returns null when the result can't be a phone number.
 */
export function normalizePrivatePhone(raw: string, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  let digits = normalizePhone(raw ?? '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 11) {
    digits = countryCode + digits.slice(1)
  }
  if (!/^[0-9]{6,20}$/.test(digits)) return null
  return digits
}

/** True when `phone` matches any number in `privateNumbers` (trunk-0 tolerant). */
export function matchesPrivateNumber(phone: string, privateNumbers: readonly string[]): boolean {
  const p = normalizePhone(phone)
  if (!p) return false
  return privateNumbers.some((n) => phonesMatch(p, n))
}

export async function listPrivateNumbers(
  admin: SupabaseClient,
  accountId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('private_contacts')
    .select('phone')
    .eq('account_id', accountId)
  if (error) {
    // Fail CLOSED is impossible here without dropping every message, so
    // log loudly. The table missing (migration not applied) lands here.
    console.error('[private-contacts] lookup failed:', error.message)
    return []
  }
  return (data ?? []).map((r: { phone: string }) => r.phone)
}

/** True when `phone` is on this account's private list. */
export async function isPrivateNumber(
  admin: SupabaseClient,
  accountId: string,
  phone: string | null | undefined,
): Promise<boolean> {
  if (!phone) return false
  const numbers = await listPrivateNumbers(admin, accountId)
  return matchesPrivateNumber(phone, numbers)
}

/**
 * Permanently delete every contact (and, through ON DELETE CASCADE,
 * their conversations, messages, notes…) whose phone matches `phone`.
 * Returns how many contacts were removed.
 */
export async function purgeContactsForNumber(
  admin: SupabaseClient,
  accountId: string,
  phone: string,
): Promise<number> {
  const { data: contacts, error } = await admin
    .from('contacts')
    .select('id, phone')
    .eq('account_id', accountId)
  if (error) throw new Error(`contact lookup failed: ${error.message}`)

  const ids = (contacts ?? [])
    .filter((c: { phone: string | null }) => c.phone && phonesMatch(c.phone, phone))
    .map((c: { id: string }) => c.id)
  if (ids.length === 0) return 0

  // Conversations cascade-delete their messages; delete them explicitly
  // first in case a deployment predates the contact→conversation cascade.
  const { error: convErr } = await admin
    .from('conversations')
    .delete()
    .eq('account_id', accountId)
    .in('contact_id', ids)
  if (convErr) throw new Error(`conversation delete failed: ${convErr.message}`)

  const { error: contactErr } = await admin
    .from('contacts')
    .delete()
    .eq('account_id', accountId)
    .in('id', ids)
  if (contactErr) throw new Error(`contact delete failed: ${contactErr.message}`)

  return ids.length
}
