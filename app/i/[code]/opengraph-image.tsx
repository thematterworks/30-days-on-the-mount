import { inviteCard, ogSize } from "@/components/invite/og";
import { inviterFor } from "@/lib/invites";

export const alt = "An invitation to 30 Days on the Mount";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const inviter = await inviterFor((await params).code);
  return inviteCard(
    inviter?.firstName ? `${inviter.firstName} invited you up the mountain` : "You're invited up the mountain",
    "Thirty days in the words of Jesus",
  );
}
