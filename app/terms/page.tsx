import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions — 30 Days on the Mount",
  description: "Terms governing the 30 Days on the Mount SMS messaging program.",
};

const EFFECTIVE_DATE = "August 12, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-foreground">
      <article className="prose prose-invert prose-headings:font-semibold prose-a:text-primary mx-auto max-w-3xl">
        <h1>Terms and Conditions</h1>
        <p className="text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

        <p>
          These Terms and Conditions (&ldquo;Terms&rdquo;) govern your participation in the 30 Days on the Mount
          mobile messaging program (the &ldquo;Program&rdquo;), operated by{" "}
          <strong>The Matterworks LLC</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), doing
          business as 30 Days on the Mount. By opting in to the Program, you agree to these Terms. If you do not
          agree, do not opt in, or reply STOP to end your participation at any time.
        </p>

        <h2>The Program</h2>
        <p>
          The Program delivers a 30-day series of daily text messages by SMS, consisting of
          scriptural reflections drawn from the Sermon on the Mount, a daily invitation and practice, and
          interactive check-ins. You may reply to any message to ask a question, share a reflection, or receive the
          full text of that day&apos;s teaching. Message frequency varies — typically one to two messages per day
          during active participation — and depends on your own replies and preferences.
        </p>

        <h2>SMS Communications</h2>
        <ul>
          <li>
            <strong>Program Description:</strong> 30 Days on the Mount provides daily reflection links and
            interactive coaching via SMS.
          </li>
          <li>
            <strong>Message Frequency:</strong> Message frequency varies.
          </li>
          <li>
            <strong>Pricing:</strong> Message and data rates may apply.
          </li>
          <li>
            <strong>Opt-Out:</strong> You can cancel the SMS service at any time. Just text &quot;STOP&quot; to +1
            (323) 747-7471. After you send the SMS message &quot;STOP&quot; to us, we will send you an SMS message to
            confirm that you have been unsubscribed. After this, you will no longer receive SMS messages from us. If
            you want to join again, just sign up as you did the first time.
          </li>
          <li>
            <strong>Help:</strong> If you are experiencing issues with the messaging program you can reply with the
            keyword &quot;HELP&quot; for more assistance, or you can get help directly at{" "}
            <a href="mailto:30daysonthemount@gmail.com">30daysonthemount@gmail.com</a>.
          </li>
          <li>
            <strong>Carrier Liability:</strong> Carriers are not liable for delayed or undelivered messages.
          </li>
          <li>
            <strong>Consent:</strong> By texting a keyword to opt in, you give your express consent to receive
            recurring automated text messages from 30 Days on the Mount. Consent to receive text messages is not a
            condition of purchasing any goods or services. The Program is free to join.
          </li>
        </ul>

        <h2>Eligibility and Opt-In</h2>
        <p>
          You join the Program by sending a text-message keyword — <strong>START</strong> or{" "}
          <strong>MOUNTAIN</strong> — to +1 (323) 747-7471. There is no web form and no purchase; texting the
          keyword is your affirmative, express consent to receive recurring automated messages, and that consent is
          not a condition of any purchase.
        </p>
        <p>
          You must be at least 18 years old, or have the consent of a parent or legal guardian, and be the account
          holder or have the account holder&apos;s permission for the mobile number you provide, to join the
          Program.
        </p>

        <h2>Message and Data Rates</h2>
        <p>
          <strong>Message and data rates may apply.</strong> The number of messages you receive will vary based on
          your participation and replies. Message frequency is recurring. Contact your wireless carrier for details
          about your text and data plan. We are not responsible for any charges billed to you by your carrier.
        </p>

        <h2>Opt-Out and Help</h2>
        <ul>
          <li>
            <strong>To opt out at any time,</strong> reply <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, or{" "}
            <strong>CANCEL</strong> to any message. You will receive a one-time confirmation that you&apos;ve been
            unsubscribed, and you will not receive further Program messages unless you opt back in. You may rejoin
            at any time by messaging us again.
          </li>
          <li>
            <strong>For help,</strong> reply <strong>HELP</strong> at any time, or contact us at{" "}
            <a href="mailto:30daysonthemount@gmail.com">30daysonthemount@gmail.com</a>.
          </li>
        </ul>
        <p>
          Supported carriers are not liable for delayed or undelivered messages. Not all mobile devices or carriers
          may support every feature of the Program.
        </p>

        <h2>User Conduct</h2>
        <p>You agree not to use the Program to:</p>
        <ul>
          <li>Send us unlawful, threatening, abusive, or harassing content.</li>
          <li>Attempt to interfere with, disrupt, or gain unauthorized access to the Program or our systems.</li>
          <li>Impersonate another person or misrepresent your affiliation with any person or entity.</li>
          <li>Use the Program for any purpose other than your own personal participation in the practice.</li>
        </ul>
        <p>
          We may suspend or terminate your access to the Program, without notice, if we reasonably believe you have
          violated these Terms.
        </p>

        <h2>Intellectual Property</h2>
        <p>
          All content delivered through the Program — including the daily invitations, synopses, guided practices,
          and original commentary — is owned by us or our licensors and is protected by copyright and other
          intellectual property laws. You may use this content for your own personal, non-commercial reflection.
          You may not reproduce, redistribute, publish, or create derivative works from it for any commercial
          purpose without our prior written permission. Scripture quotations remain the property of their
          respective copyright holders where applicable.
        </p>
        <p>
          If you submit a reflection for possible sharing in a community space, you grant us a non-exclusive,
          royalty-free license to review, moderate, and — only with an additional decision to publish on our part —
          display that submission in connection with the Program.
        </p>

        <h2>Disclaimer of Warranties</h2>
        <p>
          The Program is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
          kind, whether express or implied, including any warranty of merchantability, fitness for a particular
          purpose, or non-infringement. We do not warrant that the Program will be uninterrupted, timely, secure,
          or error-free, or that any AI-assisted response will be accurate, complete, or appropriate for your
          particular circumstances. The Program is offered for reflective and educational purposes and is not a
          substitute for professional pastoral, medical, psychological, or legal advice.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, we and our officers, employees, and service providers will not be
          liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data,
          use, or goodwill, arising out of or related to your use of, or inability to use, the Program, even if we
          have been advised of the possibility of such damages. Our total liability to you for any claim arising
          from the Program will not exceed one hundred dollars ($100).
        </p>

        <h2>Changes to the Program and These Terms</h2>
        <p>
          We may modify, suspend, or discontinue the Program, or update these Terms, at any time. If we make
          material changes to these Terms, we will update the effective date above. Your continued participation in
          the Program after a change means you accept the updated Terms.
        </p>

        <h2>Governing Law</h2>
        <p>
          These Terms are governed by the laws of the United States and the state in which we are established,
          without regard to conflict-of-law principles.
        </p>

        <h2>Contact Us</h2>
        <p>Questions about these Terms, or about the Program generally, can be sent to:</p>
        <p>
          The Matterworks LLC
          <br />
          <a href="mailto:30daysonthemount@gmail.com">30daysonthemount@gmail.com</a>
        </p>
        <p className="text-sm text-muted-foreground">
          See also our <a href="/privacy">Privacy Policy</a>, which explains what information we collect and how we
          use it.
        </p>
      </article>
    </div>
  );
}
