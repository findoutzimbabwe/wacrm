import type { Metadata } from 'next'
import { LEGAL_BRAND, LEGAL_CONTACT } from '../legal-info'

export const metadata: Metadata = { title: `Terms of Service – ${LEGAL_BRAND}` }

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: 4 November 2026</p>

      <p>
        These terms govern use of the WhatsApp customer-messaging inbox provided by {LEGAL_BRAND}, operated by Find Out
        Zimbabwe (&quot;we&quot;, &quot;us&quot;). By connecting a WhatsApp Business account or using the Service, you
        agree to them.
      </p>

      <h2>1. The Service</h2>
      <p>
        The Service lets a business receive and reply to WhatsApp messages in a shared inbox, assign conversations to
        team members, manage contacts and message templates, and optionally use automated or AI-assisted replies.
      </p>

      <h2>2. Your responsibilities</h2>
      <ul>
        <li>Comply with the WhatsApp Business Terms of Service, WhatsApp Business Messaging Policy and Meta&apos;s Commerce Policy.</li>
        <li>Only message people who have agreed to hear from you, and honour opt-out requests.</li>
        <li>Keep your login details safe and make sure your team members follow these terms.</li>
        <li>Do not use the Service for spam, fraud, harassment or anything unlawful.</li>
      </ul>

      <h2>3. WhatsApp and Meta</h2>
      <p>
        Message delivery depends on Meta&apos;s WhatsApp Business Platform. Meta may charge for some messages (for
        example, templates sent outside the 24-hour customer-service window); those charges are billed by Meta to your
        WhatsApp Business account. We are not responsible for Meta&apos;s availability, decisions or limits.
      </p>

      <h2>4. AI replies</h2>
      <p>
        AI-generated replies are produced automatically from the information you provide and may be inaccurate. You
        are responsible for reviewing the assistant&apos;s settings and for the replies sent on your behalf.
      </p>

      <h2>5. Your data</h2>
      <p>
        You own your messages and contact data. We process them only to provide the Service, as described in our{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        We aim to keep the Service available but do not guarantee uninterrupted operation. We may change or improve
        features, and will give reasonable notice of significant changes.
      </p>

      <h2>7. Suspension and termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend access if these terms or Meta&apos;s policies are
        breached.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the extent permitted by law, the Service is provided &quot;as is&quot; and we are not liable for indirect or
        consequential losses arising from its use.
      </p>

      <h2>9. Governing law</h2>
      <p>These terms are governed by the laws of Zimbabwe.</p>

      <h2>10. Contact</h2>
      <p>
        <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
      </p>
    </article>
  )
}
