import type { Metadata } from "next";
import { LegalPage } from "@/components/site/SiteChrome";
import { SitePage } from "@/components/site/SitePage";

export const metadata: Metadata = {
  title: "Privacy Policy — 30 Days on the Mount",
  description: "What 30 Days on the Mount collects, why, who helps us run it, and the choices you have.",
};

const EFFECTIVE_DATE = "November 25, 2026";
const EMAIL = "30daysonthemount@gmail.com";

// "Text messages" holds registered wording for the SMS program (A2P 10DLC):
// keep its first paragraph verbatim, and keep the operating company named
// once in "Who we are".
export default function PrivacyPolicyPage() {
  return (
    <SitePage>
      <LegalPage title="Privacy Policy" effective={EFFECTIVE_DATE}>
        <div className="site-summary">
          <p style={{ marginTop: 0 }}>
            <strong>In short:</strong> we collect what&apos;s needed to walk the thirty days with you, and nothing more. We
            never sell your information or use it for advertising. Your private reflections stay private. What you share in
            Community is seen only by the people you share it with, after it&apos;s been screened for safety. You can delete
            everything, at any time, from the app.
          </p>
        </div>

        <h2>Who we are</h2>
        <p>
          This policy explains how 30 Days on the Mount (&ldquo;we,&rdquo; &ldquo;us&rdquo;) handles information in the mobile
          app, on 30daysonthemount.com, and in the optional text-message program (the &ldquo;Service&rdquo;). 30 Days on the
          Mount is operated by The Matterworks LLC, which is responsible for your information.
        </p>

        <h2>What we collect</h2>
        <h3>To create your account</h3>
        <ul>
          <li>
            <strong>How you sign in:</strong> if you use Sign in with Apple, we receive a private identifier from Apple (and,
            the first time, your first name if you choose to share it); with email, your email address; with your phone
            number, that number.
          </li>
          <li><strong>Your first name,</strong> if you give it, so the journey can greet you and others in your groups know who you are.</li>
          <li><strong>Your profile icon or photo,</strong> if you choose one.</li>
        </ul>
        <h3>To walk the journey with you</h3>
        <ul>
          <li><strong>Progress:</strong> which day you&apos;re on, what you&apos;ve finished, and your status.</li>
          <li><strong>Preferences:</strong> your timezone, the hour of your morning invitation, and which notifications you want.</li>
          <li>
            <strong>Your reflections and conversations:</strong> what you write or say in reflections, and your conversations
            with the companion (typed, or spoken — voice conversations are turned into text, and the text is kept with your
            account).
          </li>
          <li><strong>Highlights</strong> you make in the Bible, kept on your phone.</li>
          <li><strong>Device information</strong> needed to send notifications to your phone (a push token), and basic technical logs that keep the Service running.</li>
        </ul>
        <h3>When you take part in Community</h3>
        <ul>
          <li>
            <strong>What you share:</strong> reflections, group messages, photos, videos and voice messages, the name you share
            them under, and your optional &ldquo;word about you.&rdquo; Voice messages and the sound of videos are transcribed.
          </li>
          <li><strong>Your groups</strong> and invitations, your age confirmation and agreement to the guidelines if you ask to be matched, and any reports you make.</li>
          <li><strong>Safety records:</strong> the results of screening, reports about your posts, and any warnings or other actions under the Community Guidelines.</li>
        </ul>
        <h3>If you invite someone</h3>
        <p>
          Your invitation link carries your first name and the day you&apos;re on, and we count how often it&apos;s opened.
          We don&apos;t collect information about the people you invite unless they choose to join.
        </p>
        <p>
          We don&apos;t collect payment information or your precise location, and we don&apos;t knowingly collect
          information from children under 13.
        </p>

        <h2>How we use it</h2>
        <ul>
          <li>To deliver each day&apos;s journey, at the times you choose, in the app and, if you opted in, by text message or email.</li>
          <li>To let the companion respond to what you write or say, and to prepare verse studies.</li>
          <li>To show what you share in Community to the people you shared it with, and to keep Community safe.</li>
          <li>To form walking groups, and to send notifications you&apos;ve allowed.</li>
          <li>To keep the Service secure, fix problems, and improve it.</li>
          <li>To answer you when you contact us, and to meet our legal obligations.</li>
        </ul>
        <p>
          <strong>We do not sell or rent your information, and we don&apos;t use it for advertising.</strong> We don&apos;t use
          your reflections or conversations to train AI models, and our AI providers don&apos;t use them to train theirs.
        </p>

        <h2>Who sees what</h2>
        <ul>
          <li><strong>Private reflections and companion conversations</strong> are yours. Other members never see them.</li>
          <li>
            <strong>What you share in Community</strong> is seen by the people you share it with: everyone walking that day for
            a shared reflection, or the members of a group. Other members see your first name (or &ldquo;Anonymous,&rdquo;
            where you can choose it), your icon, the day you&apos;re on, and your &ldquo;word about you.&rdquo; In groups of
            people matched together, your photo isn&apos;t shown — only an icon.
          </li>
          <li>
            <strong>Our team</strong> can see content in Community when it&apos;s held by the screen, reported, or reviewed to
            keep Community safe, and can see account information when needed to help you or run the Service.
          </li>
          <li>
            <strong>Authorities:</strong> we may share information when the law requires it, or when we believe in good faith
            that it&apos;s necessary to protect someone&apos;s safety, including reporting child sexual exploitation material
            as the law requires.
          </li>
        </ul>

        <h2>Services that help us run it</h2>
        <p>These providers process information on our behalf, only to provide their service to us:</p>
        <ul>
          <li><strong>Supabase</strong> — our database and file storage, where accounts, progress, conversations and Community content are kept.</li>
          <li><strong>Vercel</strong> — hosts the website and the servers the app talks to.</li>
          <li><strong>Anthropic</strong> — its Claude models write the companion&apos;s replies and verse studies, and screen what&apos;s shared in Community.</li>
          <li><strong>ElevenLabs</strong> — the companion&apos;s voice, reading aloud, voice conversations, and transcribing voice messages and videos for screening.</li>
          <li><strong>Apple</strong> — Sign in with Apple, and delivering notifications to your phone.</li>
          <li><strong>Twilio</strong> — sends and receives text messages, for the text-message program and phone sign-in codes.</li>
          <li><strong>Resend</strong> — sends email sign-in codes, and the daily email if you asked for it.</li>
        </ul>

        <h2>Text messages</h2>
        <p>
          No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All
          other use case categories exclude text messaging originator opt-in data and consent; this information will not be
          shared with any third parties.
        </p>
        <p>
          You opt in to text messages voluntarily by texting a keyword (START or MOUNTAIN) to our number. Consent to receive
          text messages is not a condition of purchasing any goods or services, and you may opt out at any time by replying
          STOP.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep your information while your account is active. When you delete your account, we delete your account,
          progress, reflections, conversations, photo and Community posts. A small amount may remain for a limited time in
          backups, or where we must keep it for legal or safety reasons — for example, records of serious violations of the
          Community Guidelines.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li><strong>Delete your account</strong> at any time in the app: Profile → Delete account. It can&apos;t be undone.</li>
          <li><strong>Change or turn off</strong> notifications in Profile or in your phone&apos;s Settings.</li>
          <li><strong>Delete what you&apos;ve shared</strong> in Community: press and hold your message and choose Delete.</li>
          <li><strong>Stop text messages</strong> by replying STOP.</li>
          <li>
            <strong>Ask us</strong> for a copy of your information, to correct it, or to delete it, by writing to{" "}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Depending on where you live (for example California, or the EU and UK),
            you may have further rights, and you can exercise them the same way. We won&apos;t treat you differently for using
            them.
          </li>
        </ul>

        <h2>Security</h2>
        <p>
          We use encrypted connections, private storage with short-lived links for photos and recordings, and access limited
          to those who need it. No system is perfectly secure, so we can&apos;t promise absolute security, but we work to
          protect your information and will tell you if a breach affects you, as the law requires.
        </p>

        <h2>Children</h2>
        <p>
          The Service isn&apos;t meant for children under 13, and we don&apos;t knowingly collect their information. Matching
          with other members is only for people 18 and older. If you believe a child under 13 has given us information,
          please contact us and we&apos;ll delete it.
        </p>

        <h2>Where it&apos;s stored</h2>
        <p>
          Our service providers store and process information in the United States and other countries where they operate.
          By using the Service, you understand your information may be processed there.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy as the Service grows. We&apos;ll change the effective date above and, for significant
          changes, let you know in the app.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, or a request about your information: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      </LegalPage>
    </SitePage>
  );
}
