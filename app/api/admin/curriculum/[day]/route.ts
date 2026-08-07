import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CurriculumDayRow } from "@/lib/supabase/types";

interface UpdateBody {
  title?: string;
  template_name?: string;
  fallback_text?: string;
  ai_guidance_prompt?: string;
  media_url?: string | null;
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/curriculum/[day]">) {
  const { day } = await ctx.params;
  const dayNumber = Number(day);

  if (!Number.isInteger(dayNumber) || dayNumber < 0 || dayNumber > 30) {
    return NextResponse.json({ error: "Invalid day number" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as UpdateBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const update: Partial<CurriculumDayRow> = {};
  for (const field of ["title", "template_name", "fallback_text", "ai_guidance_prompt"] as const) {
    if (typeof body[field] === "string") {
      update[field] = body[field];
    }
  }
  if (body.media_url === null || typeof body.media_url === "string") {
    update.media_url = body.media_url;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("curriculum_days")
    .update(update)
    .eq("day_number", dayNumber)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Curriculum day not found" }, { status: 404 });
  }

  return NextResponse.json({ day: data });
}
