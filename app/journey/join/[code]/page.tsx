import type { Metadata } from "next";
import { InviteExperience } from "@/components/invite/InviteExperience";
import { inviteFonts } from "@/components/invite/fonts";
import "@/components/invite/invite.css";
import { groupInvitation } from "@/lib/invites";

function clean(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export async function generateMetadata({ params }: PageProps<"/journey/join/[code]">): Promise<Metadata> {
  const group = await groupInvitation(clean((await params).code));
  const title = group ? `Walk with ${group.name}` : "Join a walking group";
  return {
    title,
    description: "Thirty days through the Sermon on the Mount, together.",
    robots: { index: false, follow: false },
    openGraph: { title, description: "A few of us are walking the Sermon on the Mount together. Join us?" },
  };
}

/**
 * Where a walking-group invitation lands: the welcome-style invitation, with
 * the group's name and its members' first names. With the app installed,
 * the last scene hands the code over (mount://join/CODE).
 */
export default async function JoinPage({ params }: PageProps<"/journey/join/[code]">) {
  const code = clean((await params).code);
  const group = await groupInvitation(code);

  if (!group) {
    return (
      <div className={`${inviteFonts} invite-root fixed inset-0 flex items-center justify-center px-8 text-center text-white`}>
        <div className="max-w-sm">
          <h1 className="invite-display text-4xl">This invitation has closed</h1>
          <p className="invite-serif mt-4 text-white/75">Ask your friend to send a fresh link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={inviteFonts}>
      <InviteExperience
        kind="group"
        groupName={group.name}
        members={group.members}
        code={code}
        appStoreURL={process.env.NEXT_PUBLIC_APP_STORE_URL || null}
      />
    </div>
  );
}
