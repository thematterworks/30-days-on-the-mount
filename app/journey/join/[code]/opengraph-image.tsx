import { inviteCard, ogSize } from "@/components/invite/og";
import { groupInvitation } from "@/lib/invites";

export const alt = "An invitation to a walking group";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const group = await groupInvitation(code);
  return inviteCard(group ? `Walk with ${group.name}` : "Walk the mount together", "Thirty days through the Sermon on the Mount, together");
}
