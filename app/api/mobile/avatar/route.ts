import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AVATAR_SYMBOLS, AVATAR_TONES, type AvatarChoice, MAX_PHOTO_BYTES, readAvatar, saveAvatar } from "@/lib/avatar";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";

/** The participant's profile icon, restored when they sign in. */
export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  return NextResponse.json({ avatar: await readAvatar(participant.phone_number) });
}

/**
 * Sets the icon: { kind: "initials" }, { kind: "symbol", symbol, tone }, or
 * { kind: "photo", photo: <base64 JPEG> }. The app squares and shrinks a
 * photo before sending it.
 */
export async function PUT(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const body = await readJson(request);
  let choice: AvatarChoice;
  let photo: Buffer | undefined;
  switch (body.kind) {
    case "initials":
      choice = { kind: "initials" };
      break;
    case "symbol":
      if (typeof body.symbol !== "string" || !AVATAR_SYMBOLS.includes(body.symbol)) return badRequest("Unknown symbol.");
      if (typeof body.tone !== "string" || !AVATAR_TONES.includes(body.tone)) return badRequest("Unknown tone.");
      choice = { kind: "symbol", symbol: body.symbol, tone: body.tone };
      break;
    case "photo":
      if (typeof body.photo !== "string") return badRequest("photo must be a base64 JPEG.");
      photo = Buffer.from(body.photo, "base64");
      // JPEG files begin FF D8.
      if (photo.length === 0 || photo.length > MAX_PHOTO_BYTES || photo[0] !== 0xff || photo[1] !== 0xd8) {
        return badRequest("photo must be a JPEG under 400 KB.");
      }
      choice = { kind: "photo" };
      break;
    default:
      return badRequest("kind must be initials, symbol or photo.");
  }

  try {
    await saveAvatar(participant.phone_number, choice, photo);
  } catch (error) {
    console.error("Saving an avatar failed", error);
    return NextResponse.json({ error: "Couldn't save your icon. Try again." }, { status: 500 });
  }
  return NextResponse.json({ avatar: await readAvatar(participant.phone_number) });
}
