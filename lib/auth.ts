import "server-only";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

export const ADMIN_SESSION_COOKIE = "mount_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  email: string;
  exp: number; // unix seconds
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.ADMIN_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Signs an admin session cookie value: base64url(payload).base64url(hmac-sha256 signature). */
export async function createSessionToken(email: string): Promise<string> {
  const payload: SessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadB64 = base64UrlEncode(payloadBytes);

  const key = await getHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${payloadB64}.${signatureB64}`;
}

/** Verifies an admin session cookie value and returns the payload if valid and unexpired. */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) return null;

  const key = await getHmacKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signatureB64) as BufferSource,
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Verifies admin credentials against ADMIN_EMAIL / ADMIN_PASSWORD_HASH (bcrypt). */
export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  if (email.trim().toLowerCase() !== env.ADMIN_EMAIL.trim().toLowerCase()) return false;
  return bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
}
