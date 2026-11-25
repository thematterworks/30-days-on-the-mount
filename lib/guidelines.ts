// The Community Guidelines as short keys — shared by the screen, the
// standing ladder (lib/standing.ts) and the admin page. The full text is
// app/community-guidelines.
export const GUIDELINES = {
  kindness: "Be kind: no harassment, insults or contempt",
  hate: "No hate: nothing demeaning anyone for who they are",
  sexual: "No sexual content or advances",
  violence: "No threats or glorifying harm",
  privacy: "Keep others' stories and private details private",
  contact: "Keep it here: no contact details or moving people elsewhere",
  spam: "No spam, selling, fundraising or promotion",
  honesty: "Be yourself: no impersonation or fake accounts",
  other: "Other",
} as const;

export type Guideline = keyof typeof GUIDELINES;

export function isGuideline(value: unknown): value is Guideline {
  return typeof value === "string" && value in GUIDELINES;
}
