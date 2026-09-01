import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — 30 Days on the Mount",
  description: "How 30 Days on the Mount collects, uses, and protects your information.",
};

const EFFECTIVE_DATE = "August 12, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-foreground">
      <article className="prose prose-invert prose-headings:font-semibold prose-a:text-primary mx-auto max-w-3xl">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

        <p>
          <strong>The Matterworks LLC</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), doing
          business as 30 Days on the Mount, offers a 30-day guided reflection practice delivered by SMS text
          message, and optionally by email, that participants join voluntarily. This policy explains what
          information we collect when you use the service, why we collect it, who we share it with, and the choices
          available to you. It applies to everyone who messages our SMS number or otherwise participates in the
          practice.
        </p>

        <h2>SMS/Mobile Data</h2>
        <p>
          No mobile information will be shared with third parties or affiliates for marketing or promotional
          purposes. All other use case categories exclude text messaging originator opt-in data and consent; this
          information will not be shared with any third parties.
        </p>
        <p>
          You opt in to text messages voluntarily by texting a keyword (START or MOUNTAIN) to our number. Consent to
          receive text messages is not a condition of purchasing any goods or services, and you may opt out at any
          time by replying STOP.
        </p>

        <h2>Information We Collect</h2>
        <p>We collect only what is needed to run the practice and communicate with you:</p>
        <ul>
          <li>
            <strong>Phone number.</strong> Provided when you text us to join. This is how we identify your account
            and deliver daily messages.
          </li>
          <li>
            <strong>First name (optional).</strong> Collected during onboarding so we can address you personally.
          </li>
          <li>
            <strong>Email address (optional).</strong> Collected only if you tell us you&apos;d like to also
            receive daily content by email.
          </li>
          <li>
            <strong>Timezone and preferred delivery hour.</strong> Collected during onboarding so your daily
            message arrives at a time you choose, rather than a fixed time for everyone.
          </li>
          <li>
            <strong>Conversation history.</strong> The messages you send us and the replies you receive, including
            AI-assisted responses to your reflections, so the practice can respond to what you actually write and
            so we can review conversations for quality and support purposes.
          </li>
          <li>
            <strong>Community reflections (optional).</strong> If you submit a reflection for possible sharing in a
            community space, that content — along with the phone number that submitted it — is reviewed by our
            team before any decision to publish it.
          </li>
          <li>
            <strong>Progress data.</strong> Which day of the 30-day practice you&apos;re on and your participation
            status (for example, active, paused, or completed).
          </li>
        </ul>
        <p>
          We do not collect payment information, precise location data, or any information from anyone we know to
          be under the age of 13.
        </p>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To deliver the daily practice content you signed up for, at the time you asked to receive it.</li>
          <li>To respond to the reflections and questions you send us, including generating a reply with AI.</li>
          <li>To operate, maintain, and improve the practice and the underlying service.</li>
          <li>To send the same day&apos;s content by email, if you opted into that.</li>
          <li>To moderate and, with your submission, potentially publish community reflections.</li>
          <li>To respond if you contact us directly with a question or request.</li>
        </ul>
        <p>We do not sell your information, and we do not use it for advertising.</p>

        <h2>AI-Assisted Responses</h2>
        <p>
          When you reply to a daily message, the text of your reply is sent to Anthropic (the maker of the Claude
          AI models) so we can generate a thoughtful, contextual response. Anthropic processes that message on our
          behalf to produce the reply; it is not used to train Anthropic&apos;s models under our agreement with
          them.
        </p>

        <h2>Third-Party Service Providers</h2>
        <p>
          We rely on the following infrastructure providers to operate the service. Each processes the specific
          data described below on our behalf, under their own privacy and security commitments:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> — hosts our website and application infrastructure.
          </li>
          <li>
            <strong>Supabase</strong> — stores our database, including participant records and conversation
            history, on Supabase&apos;s managed PostgreSQL infrastructure.
          </li>
          <li>
            <strong>Twilio</strong> — delivers and receives the SMS text messages that make up the practice, on our
            behalf. Mobile opt-in data and consent are never shared for marketing or promotional purposes.
          </li>
          <li>
            <strong>Resend</strong> — delivers the optional daily email, for participants who opt in.
          </li>
          <li>
            <strong>Anthropic</strong> — processes the text of your replies to generate AI-assisted responses, as
            described above.
          </li>
        </ul>

        <h2>Data Retention</h2>
        <p>
          We retain participant and conversation data for as long as your account is active or as needed to
          operate the practice, and for a reasonable period afterward in case you return or to comply with our
          legal obligations. You can ask us to delete your data at any time — see &ldquo;Your Rights and
          Choices&rdquo; below.
        </p>

        <h2>Your Rights and Choices</h2>
        <ul>
          <li>
            <strong>Access or correction.</strong> You can ask us what information we have about you, and ask us to
            correct it.
          </li>
          <li>
            <strong>Deletion.</strong> You can ask us to delete your information at any time.
          </li>
          <li>
            <strong>Opting out.</strong> Reply <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, or{" "}
            <strong>CANCEL</strong> to any message at any time and we will immediately stop sending you daily
            messages and confirm it back to you. You can also reach us using the email below to pause or remove
            your account.
          </li>
        </ul>
        <p>
          To exercise any of these choices, contact us using the email address at the bottom of this page. We will
          respond within a reasonable time.
        </p>

        <h2>Data Security</h2>
        <p>
          We use industry-standard measures to protect your information, including encrypted connections,
          access-controlled infrastructure, and restricting who on our team can view participant data. No method of
          transmission or storage is completely secure, and we cannot guarantee absolute security.
        </p>

        <h2>Children&apos;s Privacy</h2>
        <p>
          This service is not directed to, and is not intended for use by, anyone under the age of 13. We do not
          knowingly collect information from children under 13. If you believe a child has provided us with
          information, please contact us and we will delete it.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. If we make material changes, we will update the effective
          date above. Continued use of the service after a change means you accept the updated policy.
        </p>

        <h2>Contact Us</h2>
        <p>
          For questions about this policy, or to request access to, correction of, or deletion of your data, contact
          us at:
        </p>
        <p>
          The Matterworks LLC
          <br />
          <a href="mailto:30daysonthemount@gmail.com">30daysonthemount@gmail.com</a>
        </p>
        <p className="text-sm text-muted-foreground">
          See also our <a href="/terms">Terms and Conditions</a>, which govern your participation in the messaging
          program.
        </p>
      </article>
    </div>
  );
}
