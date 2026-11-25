import type { Metadata } from "next";
import { LegalPage } from "@/components/site/SiteChrome";
import { SitePage } from "@/components/site/SitePage";

export const metadata: Metadata = {
  title: "Community Guidelines — 30 Days on the Mount",
  description: "How we walk together in 30 Days on the Mount: what we share, how we treat each other, and what happens when the guidelines are broken.",
};

const EFFECTIVE_DATE = "November 25, 2026";
const EMAIL = "30daysonthemount@gmail.com";

// The same guidelines and ladder the app enforces (lib/standing.ts). Change
// one, change the other.
export default function CommunityGuidelinesPage() {
  return (
    <SitePage>
      <LegalPage title="Community Guidelines" effective={EFFECTIVE_DATE}>

        <p>
          Community is the part of 30 Days on the Mount where people walk the Sermon on the Mount together: reflections
          shared with others on the same day, walking groups with friends, and small groups of people matched on nearby
          days. It works only if everyone can be honest without being hurt. These guidelines describe how we do that, and
          what happens when they&apos;re broken. They are part of our <a href="/terms">Terms and Conditions</a>.
        </p>

        <h2>How we walk together</h2>
        <ol>
          <li>
            <strong>Be kind.</strong> Encourage each other. Honest doubt, grief, anger and struggle are welcome here;
            harassment, insults, mockery and contempt are not. Don&apos;t correct, debate or preach at each other.
          </li>
          <li>
            <strong>No hate.</strong> Nothing that demeans anyone for their race, ethnicity, nationality, sex, gender,
            sexual orientation, disability, age or religion — including faiths other than yours.
          </li>
          <li>
            <strong>No sexual content or advances.</strong> No sexual or explicit words, photos or videos, and no romantic
            or flirtatious approaches to other members. Community is not a dating space.
          </li>
          <li>
            <strong>No threats or harm.</strong> Never threaten anyone, encourage anyone to harm themselves or others, or
            share violent or graphic material.
          </li>
          <li>
            <strong>Keep others&apos; stories private.</strong> What someone shares in a group stays in the group. Don&apos;t
            post anyone else&apos;s name, photo, story or private details without their permission, and don&apos;t record or
            screenshot others to share elsewhere.
          </li>
          <li>
            <strong>Keep it here.</strong> In matched groups, don&apos;t share or ask for phone numbers, emails, addresses,
            social media handles or other apps, and don&apos;t arrange to meet. There are no private messages, by design.
          </li>
          <li>
            <strong>No spam, selling or fundraising.</strong> No ads, promotion, links to sell things, requests for money,
            or recruiting into other groups or causes.
          </li>
          <li>
            <strong>Be yourself.</strong> Use your real first name. No impersonation and no fake or duplicate accounts.
          </li>
          <li>
            <strong>Share only what&apos;s yours to share.</strong> Photos, videos and voice messages must be your own or
            shared with permission, and follow every guideline above.
          </li>
        </ol>
        <p>
          Matched groups are for adults: you must be 18 or older to be matched with other members.
        </p>

        <h2>If you&apos;re struggling</h2>
        <p>
          Community is companionship, not crisis care. If something you share suggests you may be in danger, we&apos;ll
          keep it private and point you to people who can help. Being in distress is never a violation. In the United
          States you can call or text <strong>988</strong> at any time; if you are in immediate danger, call 911.
        </p>

        <h2>How everything is kept safe</h2>
        <ul>
          <li>
            <strong>Everything is screened before anyone else sees it.</strong> Every reflection, message, photo, video and
            voice message is read by an automated screen (an AI model) first. Voice messages and the sound of videos are
            transcribed so they can be read. Clearly safe posts appear right away; anything uncertain waits for a person
            on our team; anything that breaks these guidelines is not shown.
          </li>
          <li>
            <strong>People review what&apos;s uncertain or reported.</strong> Our team reviews held posts and every report,
            and can see posts in groups in order to keep them safe.
          </li>
          <li>
            <strong>You can report anything.</strong> Press and hold a message and choose Report. Two reports hide a post
            until we&apos;ve looked at it. You can leave any group at any time.
          </li>
        </ul>

        <h2>What happens when the guidelines are broken</h2>
        <p>Each confirmed break of these guidelines is a strike. Strikes count for 90 days.</p>
        <table>
          <thead>
            <tr>
              <th>Strike (within 90 days)</th>
              <th>What happens</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>First</td>
              <td>The post is removed and you receive a private warning naming the guideline.</td>
            </tr>
            <tr>
              <td>Second</td>
              <td>You can&apos;t post anywhere in Community for 7 days. You can still read, and your journey continues.</td>
            </tr>
            <tr>
              <td>Third</td>
              <td>You&apos;re removed from Community: you leave every group and can&apos;t share, join or be matched. Your journey continues.</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Serious violations skip these steps.</strong> Threats of violence, any sexual content or advances, hate,
          exposing someone&apos;s private information, or any attempt to exploit, deceive or groom another member lead to
          immediate removal from Community. We may also <strong>suspend the whole account</strong>, which signs you out
          and ends access to the app, for serious or repeated violations, fake or duplicate accounts, spam, or anything
          that puts others at risk.
        </p>
        <p>
          Where the law requires it, or where someone&apos;s safety is at risk, we may report content and information to
          the appropriate authorities, including reporting any child sexual exploitation material to the National Center
          for Missing &amp; Exploited Children.
        </p>

        <h2>Appeals</h2>
        <p>
          The automated screen can be wrong. If you believe a post was removed or a strike was given in error, write to{" "}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a> from the email or phone number on your account and tell us what happened.
          A person will review it, and if we got it wrong we&apos;ll remove the strike and restore your standing.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these guidelines as Community grows. We&apos;ll change the effective date above, and tell you in
          the app when a change is significant.
        </p>
      </LegalPage>
    </SitePage>
  );
}
