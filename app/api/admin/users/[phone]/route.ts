import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRow, UserStatus } from "@/lib/supabase/types";

const VALID_STATUSES: UserStatus[] = ["active", "paused", "completed", "opted_out"];

interface UpdateBody {
  status?: UserStatus;
  current_day?: number;
  notes?: string;
  ai_paused?: boolean;
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/users/[phone]">) {
  const { phone } = await ctx.params;
  const body = (await request.json().catch(() => null)) as UpdateBody | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const update: Partial<UserRow> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.current_day !== undefined) {
    if (!Number.isInteger(body.current_day) || body.current_day < 0 || body.current_day > 30) {
      return NextResponse.json({ error: "current_day must be an integer between 0 and 30" }, { status: 400 });
    }
    update.current_day = body.current_day;
  }
  if (body.notes !== undefined) {
    update.notes = body.notes;
  }
  if (body.ai_paused !== undefined) {
    update.ai_paused = body.ai_paused;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .update(update)
    .eq("phone_number", decodeURIComponent(phone))
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}
