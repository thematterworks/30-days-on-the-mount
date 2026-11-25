import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// The card a shared invitation shows in Messages and elsewhere: the brand
// gradient, the mountain, and who's inviting.

export const ogSize = { width: 1200, height: 630 };

export async function inviteCard(headline: string, subline: string): Promise<ImageResponse> {
  const mountain = await readFile(path.join(process.cwd(), "public/invite/mountain-line.png"));
  const src = `data:image/png;base64,${mountain.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #8a8396 0%, #737293 48%, #546391 100%)",
          color: "white",
          padding: 80,
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={300} height={99} alt="" style={{ opacity: 0.9 }} />
        <div style={{ marginTop: 40, fontSize: 22, letterSpacing: 8, textTransform: "uppercase", color: "#f6cdaf" }}>
          30 Days on the Mount
        </div>
        <div style={{ marginTop: 22, fontSize: 64, fontFamily: "serif", lineHeight: 1.1, maxWidth: 1000 }}>{headline}</div>
        <div style={{ marginTop: 22, fontSize: 28, color: "rgba(255,255,255,0.8)", maxWidth: 900 }}>{subline}</div>
      </div>
    ),
    ogSize,
  );
}
