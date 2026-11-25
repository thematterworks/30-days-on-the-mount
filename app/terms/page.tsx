import type { Metadata } from "next";
import { LegalPage } from "@/components/site/SiteChrome";
import { SitePage } from "@/components/site/SitePage";

export const metadata: Metadata = {
  title: "Terms of Use — 30 Days on the Mount",
  description: "The terms for using 30 Days on the Mount: the app, the website, and the text-message program.",
};

const EFFECTIVE_DATE = "November 25, 2026";
const EMAIL = "30daysonthemount@gmail.com";

// The text-message sections below are registered wording for the SMS
// program (A2P 10DLC): keep the program description, frequency, rates,
// STOP/HELP, carrier liability and consent lines intact, and keep the
// operating company named once in "Who we are".
export default function TermsPage() {
  return (
    <SitePage>
      <LegalPage title="Terms of Use" effective={EFFECTIVE_DATE}>
        <div className="site-summary">
          <p style={{ marginTop: 0 }}>
            <strong>In short:</strong> 30 Days on the Mount is a free, thirty-day journey through the Sermon on the Mount.
            Use it for your own reflection, treat others in Community with care, and know that the companion and studies are
            written with AI and aren&apos;t a substitute for a pastor, counselor or doctor. You can delete your account at any
            time.
          </p>
        </div>

        <h2>Who we are</h2>
        <p>
          These Terms of Use (&ldquo;Terms&rdquo;) cover your use of 30 Days on the Mount (&ldquo;we,&rdquo; &ldquo;us&rdquo;)
          — the mobile app, the website at 30daysonthemount.com, and the optional text-message program (together, the
          &ldquo;Service&rdquo;). 30 Days on the Mount is operated by The Matterworks LLC. By creating an account, using the
          app, or texting our number, you agree to these Terms and to our <a href="/privacy">Privacy Policy</a>. If you
          don&apos;t agree, please don&apos;t use the Service.
        </p>

        <h2>The journey</h2>
        <p>
          The Service guides you through Matthew 5–7, one day at a time, for thirty days: a daily passage and teaching,
          optional midday and evening invitations, reflection, a conversational companion, the Bible with verse studies,
          ambient music, and Community features. The Service is free. We may change, add or remove features over time.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>
            You can sign in with Apple, with your email address, or with your phone number. Please give accurate information
            and keep access to your sign-in method secure. You are responsible for what happens under your account.
          </li>
          <li>One account per person. Don&apos;t create accounts for others, or fake or duplicate accounts.</li>
          <li>
            You can delete your account at any time in the app (Profile → Delete account). That permanently removes your
            journey, reflections, highlights and conversations, as described in our Privacy Policy.
          </li>
        </ul>

        <h2>Who can use it</h2>
        <p>
          You must be at least 13 years old to use the Service. If you are under 18, you need a parent or guardian&apos;s
          permission. Being matched into a walking group with other members you don&apos;t know is only for people 18 and
          older, and you&apos;ll be asked to confirm your age first.
        </p>

        <h2>The companion, studies and AI</h2>
        <p>
          The companion&apos;s replies, voice conversations, verse studies and some of the daily content are generated with
          artificial intelligence. We work to make them faithful and careful, but they can be wrong, incomplete or
          unsuitable for your situation. They are offered for reflection and learning, and are not pastoral, medical,
          psychological, legal or financial advice. Please bring important questions to people you trust.
        </p>
        <p>
          <strong>If you are in crisis</strong> or thinking about harming yourself, call or text 988 (in the United States)
          or call 911 in an emergency. The Service is not a crisis service.
        </p>

        <h2>Community</h2>
        <p>
          Community lets you share reflections with others walking the same day, walk in groups with friends, and, if
          you&apos;re 18 or older, be matched into a small group with others on nearby days. Your use of Community is governed
          by our <a href="/community-guidelines">Community Guidelines</a>, which are part of these Terms.
        </p>
        <ul>
          <li>
            Everything shared in Community — words, photos, videos and voice messages — is screened before others see it, by
            an automated system (an AI model) and, where needed, by people on our team. Voice messages and the sound of videos
            are transcribed for screening. We may remove anything that breaks these Terms or the Community Guidelines.
          </li>
          <li>
            Breaking the Community Guidelines leads to a warning, a pause on posting, removal from Community, or suspension
            of your account, as the Guidelines describe. We may act immediately for serious violations, and may report
            content to authorities where the law requires it or someone&apos;s safety is at risk.
          </li>
          <li>
            Other members are not our employees or representatives, and we aren&apos;t responsible for what they say or do,
            though we work hard to keep Community safe. You can report anything, and leave any group, at any time.
          </li>
        </ul>

        <h2>What you share</h2>
        <p>
          You own what you write, record and share (&ldquo;your content&rdquo;). You give us a non-exclusive, worldwide,
          royalty-free license to store, process, screen, transcribe and display your content, only to run the Service — for
          example, to show your reflection to the people you shared it with, or to let the companion respond to it. Private
          reflections stay private. You confirm that your content is yours to share and doesn&apos;t infringe anyone
          else&apos;s rights, and that photos or recordings of other people are shared with their permission.
        </p>

        <h2>Acceptable use</h2>
        <p>Please don&apos;t:</p>
        <ul>
          <li>Harass, threaten, deceive, exploit or harm anyone, or try to contact members outside the Service against the Community Guidelines.</li>
          <li>Share anything unlawful, hateful, sexually explicit, or that infringes someone else&apos;s rights.</li>
          <li>Impersonate anyone, or misrepresent who you are.</li>
          <li>Use the Service to advertise, sell, fundraise, or recruit.</li>
          <li>Interfere with the Service, probe or bypass its security, scrape it, or use bots or automated access.</li>
          <li>Use the Service for anything other than your own personal participation.</li>
        </ul>

        <h2>Text messages</h2>
        <p>If you choose to receive the journey by text message, these terms also apply:</p>
        <ul>
          <li>
            <strong>Program description:</strong> 30 Days on the Mount provides daily reflection links and interactive
            coaching via SMS.
          </li>
          <li>
            <strong>How to join:</strong> text <strong>START</strong> or <strong>MOUNTAIN</strong> to +1 (323) 747-7471.
            Texting the keyword is your express consent to receive recurring automated text messages from 30 Days on the
            Mount. Consent to receive text messages is not a condition of purchasing any goods or services. The program is
            free to join.
          </li>
          <li>
            <strong>Message frequency:</strong> message frequency varies, typically one to two messages a day while you are
            active, depending on your replies and preferences.
          </li>
          <li>
            <strong>Pricing:</strong> message and data rates may apply. Contact your wireless carrier about your plan.
          </li>
          <li>
            <strong>Opt-out:</strong> you can cancel at any time. Text <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong> or{" "}
            <strong>CANCEL</strong> to +1 (323) 747-7471. We&apos;ll send one message to confirm you&apos;ve been
            unsubscribed, and then no more. To join again, text START as you did the first time.
          </li>
          <li>
            <strong>Help:</strong> reply <strong>HELP</strong> at any time, or write to{" "}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </li>
          <li>
            <strong>Carrier liability:</strong> carriers are not liable for delayed or undelivered messages.
          </li>
          <li>
            <strong>Eligibility:</strong> you must be the account holder for the mobile number, or have their permission.
          </li>
        </ul>

        <h2>Notifications</h2>
        <p>
          The app can send notifications for your morning, midday and evening invitations and for your walking groups. You
          can change them in Profile or turn them off in your phone&apos;s Settings.
        </p>

        <h2>Our content</h2>
        <p>
          The daily invitations, teachings, design, music and other materials in the Service belong to us or our licensors.
          You may use them for your own personal, non-commercial reflection, and share them with friends, but not reproduce,
          sell or publish them without our permission. Scripture quotations are from the Berean Standard Bible (BSB), which
          is in the public domain.
        </p>

        <h2>Apple</h2>
        <p>
          If you use the app on an Apple device: these Terms are between you and us, not Apple, and Apple isn&apos;t
          responsible for the app or its content. Apple has no obligation to provide maintenance or support for the app. If
          the app fails to meet any applicable warranty, you may notify Apple, and Apple&apos;s only obligation will be to
          refund any purchase price (the app is free). Apple isn&apos;t responsible for addressing claims about the app,
          including product liability, legal compliance, or intellectual-property claims. Apple and its subsidiaries are
          third-party beneficiaries of these Terms and may enforce them against you. You confirm you aren&apos;t located in
          a country subject to a U.S. government embargo and aren&apos;t on any U.S. government list of prohibited parties.
        </p>

        <h2>Ending your use</h2>
        <p>
          You can stop using the Service and delete your account at any time. We may suspend or end your access if you
          break these Terms or the Community Guidelines, or if we need to in order to protect others or comply with the law.
        </p>

        <h2>Disclaimers</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, whether
          express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement.
          We don&apos;t promise that the Service will be uninterrupted, secure or error-free, or that AI-generated content will
          be accurate or appropriate for your circumstances.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, we and our officers, employees and service providers will not be liable
          for any indirect, incidental, special, consequential or punitive damages, or any loss of data, use or goodwill,
          arising out of or related to your use of, or inability to use, the Service, even if advised of the possibility of
          such damages. Our total liability to you for any claim arising from the Service will not exceed one hundred
          dollars ($100).
        </p>

        <h2>Changes</h2>
        <p>
          We may update these Terms as the Service grows. We&apos;ll change the effective date above and, for significant
          changes, let you know in the app. Continuing to use the Service after a change means you accept the updated Terms.
        </p>

        <h2>Governing law</h2>
        <p>
          These Terms are governed by the laws of the United States and the state in which we are established, without
          regard to conflict-of-law principles.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these Terms, or anything else: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      </LegalPage>
    </SitePage>
  );
}
