import type { Metadata } from 'next'
import { LEGAL_BRAND, LEGAL_CONTACT } from '../legal-info'

export const metadata: Metadata = { title: `Privacy Policy – ${LEGAL_BRAND}` }

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: 4 November 2026</p>

      <p>
        {LEGAL_BRAND} (&quot;we&quot;, &quot;us&quot;), operated by Find Out Zimbabwe in Zimbabwe, provides a
        WhatsApp customer-messaging inbox for businesses (&quot;the Service&quot;). This policy explains what
        information the Service handles, why, and the choices available to you.
      </p>

      <h2>1. Who this applies to</h2>
      <ul>
        <li><strong>Businesses</strong> that connect a WhatsApp Business account to the Service, and their team members.</li>
        <li><strong>Customers</strong> who send WhatsApp messages to a business that uses the Service.</li>
      </ul>

      <h2>2. Information we process</h2>
      <ul>
        <li><strong>WhatsApp messages and media</strong> exchanged between a business and its customers, received through Meta&apos;s WhatsApp Business Platform.</li>
        <li><strong>Contact details</strong> provided by WhatsApp: phone number, WhatsApp profile name and, where applicable, a WhatsApp username or business-scoped user ID.</li>
        <li><strong>Business account data</strong>: WhatsApp Business Account and phone-number identifiers, message templates, and access tokens (stored encrypted).</li>
        <li><strong>Team member accounts</strong>: name, email address and login information for people who use the inbox.</li>
        <li><strong>Usage and technical data</strong> such as log entries needed to operate and secure the Service.</li>
      </ul>

      <h2>3. How we use information</h2>
      <ul>
        <li>To deliver messages between a business and its customers and show them in the business&apos;s inbox.</li>
        <li>To let a business assign conversations to team members, organise contacts and manage message templates.</li>
        <li>Where a business enables it, to generate automated replies with an AI assistant based on the conversation and information the business provides.</li>
        <li>To keep the Service secure, prevent abuse and comply with legal obligations.</li>
      </ul>
      <p>We do not sell personal information and do not use message content for advertising.</p>

      <h2>4. Who we share information with</h2>
      <p>We use trusted service providers who process data on our behalf:</p>
      <ul>
        <li><strong>Meta Platforms</strong> – WhatsApp Business Platform (message delivery).</li>
        <li><strong>Supabase</strong> – database and file storage.</li>
        <li><strong>Vercel</strong> – application hosting.</li>
        <li><strong>An AI model provider</strong> chosen by the business – only when AI replies are switched on.</li>
      </ul>
      <p>We may also disclose information when required by law.</p>

      <h2>5. Business controls</h2>
      <p>
        Each business decides which conversations are stored. A business owner can mark numbers as private so their
        messages are never stored, and can permanently delete conversations and contacts from the Service at any time.
      </p>

      <h2>6. Retention</h2>
      <p>
        Messages and contact data are kept for as long as the business keeps its account active or until the
        business deletes them. When a business disconnects and asks us to close its account, its data is deleted
        within 30 days, except where we must keep it longer by law.
      </p>

      <h2 id="data-deletion">7. Your rights and data deletion</h2>
      <p>
        You may ask to access, correct or delete your personal information. If you are a customer of a business
        using the Service, you can contact that business directly, or email us at{' '}
        <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a> with the subject &quot;Data deletion&quot; and the
        WhatsApp number concerned. We will confirm and complete the request within 30 days.
      </p>
      <p>
        If you connected the Service through Facebook Login, you can also remove its access at any time in your
        Facebook settings under <em>Business Integrations</em>.
      </p>

      <h2>8. Security</h2>
      <p>
        Data is transmitted over HTTPS, access tokens are encrypted at rest, and access inside the Service is limited
        by user roles.
      </p>

      <h2>9. Changes</h2>
      <p>We may update this policy and will change the date above when we do.</p>

      <h2>10. Contact</h2>
      <p>
        {LEGAL_BRAND}, Zimbabwe – <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
      </p>
    </article>
  )
}
