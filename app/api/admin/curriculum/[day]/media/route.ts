import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "curriculum-media";
// Vercel Functions cap request bodies around 4.5MB for standard (non-streaming)
// route handlers — keep a safety margin under that for the multipart payload.
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPE_PREFIXES = ["image/", "video/"];

function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

function safeExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]{1,10})$/.exec(filename);
  return match ? `.${match[1].toLowerCase()}` : "";
}

async function getDayNumber(ctx: RouteContext<"/api/admin/curriculum/[day]/media">) {
  const { day } = await ctx.params;
  const dayNumber = Number(day);
  if (!Number.isInteger(dayNumber) || dayNumber < 0 || dayNumber > 30) return null;
  return dayNumber;
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/curriculum/[day]/media">) {
  const dayNumber = await getDayNumber(ctx);
  if (dayNumber === null) {
    return NextResponse.json({ error: "Invalid day number" }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPE_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    return NextResponse.json({ error: "Only image or video files are supported" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: existingDay } = await supabase
    .from("curriculum_days")
    .select("media_url")
    .eq("day_number", dayNumber)
    .maybeSingle();

  const path = `day-${dayNumber}/${Date.now()}${safeExtension(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from("curriculum_days")
    .update({ media_url: publicUrlData.publicUrl })
    .eq("day_number", dayNumber)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const previousPath = existingDay?.media_url ? storagePathFromPublicUrl(existingDay.media_url) : null;
  if (previousPath) {
    await supabase.storage.from(BUCKET).remove([previousPath]);
  }

  return NextResponse.json({ day: data });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/curriculum/[day]/media">) {
  const dayNumber = await getDayNumber(ctx);
  if (dayNumber === null) {
    return NextResponse.json({ error: "Invalid day number" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existingDay } = await supabase
    .from("curriculum_days")
    .select("media_url")
    .eq("day_number", dayNumber)
    .maybeSingle();

  const { data, error } = await supabase
    .from("curriculum_days")
    .update({ media_url: null })
    .eq("day_number", dayNumber)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const path = existingDay?.media_url ? storagePathFromPublicUrl(existingDay.media_url) : null;
  if (path) {
    await supabase.storage.from(BUCKET).remove([path]);
  }

  return NextResponse.json({ day: data });
}
