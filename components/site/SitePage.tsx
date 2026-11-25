import { inviteFonts } from "@/components/invite/fonts";
import "@/components/site/site.css";

/** The public site's stage: the app's fonts and gradient. */
export function SitePage({ children }: { children: React.ReactNode }) {
  return <div className={`${inviteFonts} site`}>{children}</div>;
}
