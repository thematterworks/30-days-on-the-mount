import { inviteCard, ogSize } from "@/components/invite/og";

export const alt = "30 Days on the Mount — thirty days in the words of Jesus";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image() {
  return inviteCard("Come up the mountain", "Thirty days in the words of Jesus");
}
