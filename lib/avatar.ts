import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// The app's profile icon, kept with the account so it survives signing out
// and moving to a new phone. Private bucket: a photo is personal, so it's
// served by short-lived signed URLs, never publicly.
const BUCKET = "avatars";
const SIGNED_URL_SECONDS = 60 * 60;
export const MAX_PHOTO_BYTES = 400 * 1024;

export const AVATAR_SYMBOLS = ["mountain.2", "sun.horizon", "leaf", "flame", "drop", "moon.stars", "sparkles", "bird", "water.waves", "heart"];
export const AVATAR_TONES = ["peach", "lavender", "periwinkle", "navy"];

export type AvatarChoice = { kind: "initials" } | { kind: "symbol"; symbol: string; tone: string } | { kind: "photo" };

function folder(phoneNumber: string) {
  return crypto.createHash("sha256").update(phoneNumber).digest("hex");
}

function storage() {
  return getSupabaseAdmin().storage.from(BUCKET);
}

/** The participant's icon as the app reads it, or null if they never chose. */
export async function readAvatar(phoneNumber: string) {
  const { data } = await storage().download(`${folder(phoneNumber)}/choice.json`);
  if (!data) return null;
  let choice: AvatarChoice;
  try {
    choice = JSON.parse(await data.text()) as AvatarChoice;
  } catch {
    return null;
  }
  if (choice.kind !== "photo") return choice;
  const { data: signed } = await storage().createSignedUrl(`${folder(phoneNumber)}/photo.jpg`, SIGNED_URL_SECONDS);
  return signed?.signedUrl ? { kind: "photo" as const, photoURL: signed.signedUrl } : { kind: "initials" as const };
}

export async function saveAvatar(phoneNumber: string, choice: AvatarChoice, photo?: Buffer) {
  const base = folder(phoneNumber);
  if (photo) {
    const { error } = await storage().upload(`${base}/photo.jpg`, photo, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
  } else {
    await storage().remove([`${base}/photo.jpg`]);
  }
  const { error } = await storage().upload(`${base}/choice.json`, JSON.stringify(choice), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw error;
}

export async function deleteAvatar(phoneNumber: string) {
  const base = folder(phoneNumber);
  await storage().remove([`${base}/choice.json`, `${base}/photo.jpg`]);
}
