import type { Metadata } from "next";
import { InviteExperience } from "@/components/invite/InviteExperience";
import { inviteFonts } from "@/components/invite/fonts";
import "@/components/invite/invite.css";
import { inviterFor, recordInviteOpen } from "@/lib/invites";

export async function generateMetadata({ params }: PageProps<"/i/[code]">): Promise<Metadata> {
  const inviter = await inviterFor((await params).code);
  const title = inviter?.firstName ? `${inviter.firstName} invited you up the mountain` : "You're invited up the mountain";
  return {
    title,
    description: "Thirty days in the words of Jesus: the Sermon on the Mount, one morning at a time.",
    robots: { index: false, follow: false },
    openGraph: { title, description: "Thirty days in the words of Jesus. Walk it with me?" },
  };
}

/** Where a participant's own Share-the-journey link lands (lib/invites.ts). */
export default async function PersonalInvitePage({ params }: PageProps<"/i/[code]">) {
  const { code } = await params;
  const inviter = await inviterFor(code);
  if (inviter) await recordInviteOpen(code);
  return (
    <div className={inviteFonts}>
      <InviteExperience
        kind="personal"
        inviterName={inviter?.firstName ?? null}
        inviterDay={inviter?.currentDay ?? null}
        appStoreURL={process.env.NEXT_PUBLIC_APP_STORE_URL || null}
      />
    </div>
  );
}
