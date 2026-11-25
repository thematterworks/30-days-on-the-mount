import { Bodoni_Moda, Inter, Source_Serif_4 } from "next/font/google";

// The app's type, on the web: a Didot-like display face, a reading serif,
// and a quiet sans for labels.
const display = Bodoni_Moda({ variable: "--font-invite-display", subsets: ["latin"], display: "swap" });
const serif = Source_Serif_4({ variable: "--font-invite-serif", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });
const sans = Inter({ variable: "--font-invite-sans", subsets: ["latin"], display: "swap" });

export const inviteFonts = `${display.variable} ${serif.variable} ${sans.variable}`;
