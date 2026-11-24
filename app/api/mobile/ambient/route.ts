import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileParticipant, unauthorized } from "@/lib/mobile";
import { getSystemConfigValue } from "@/lib/system-config";

type AmbientTrack = { title: string; artist: string; url: string; credit: string | null };

/** The ambient music the app rotates through (system_config.ambient_tracks). */
export async function GET(request: NextRequest) {
  if (!(await getMobileParticipant(request))) return unauthorized();

  let tracks: AmbientTrack[] = [];
  try {
    const parsed: unknown = JSON.parse(await getSystemConfigValue("ambient_tracks", "[]"));
    if (Array.isArray(parsed)) {
      tracks = parsed.filter(
        (track): track is AmbientTrack =>
          typeof track?.title === "string" && typeof track?.url === "string" && track.url.startsWith("https://"),
      ).map((track) => ({ title: track.title, artist: track.artist ?? "", url: track.url, credit: track.credit ?? null }));
    }
  } catch (error) {
    console.error("ambient_tracks isn't valid JSON", error);
  }
  return NextResponse.json({ tracks });
}
