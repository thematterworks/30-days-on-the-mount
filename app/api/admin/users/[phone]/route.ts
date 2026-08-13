import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { OnboardingStep, UserRow, UserStatus } from "@/lib/supabase/types";

const VALID_STATUSES: UserStatus[] = ["active", "paused", "completed", "opted_out"];
const VALID_ONBOARDING_STEPS: OnboardingStep[] = [
  "not_started",
  "awaiting_name",
  "awaiting_time",
  "awaiting_email_pref",
  "awaiting_email_address",
  "completed",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UpdateBody {
  status?: UserStatus;
  current_day?: number;
  notes?: string;
  ai_paused?: boolean;
  onboarding_step?: OnboardingStep;
  first_name?: string | null;
  preferred_delivery_hour?: number | null;
  email_address?: string | null;
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
    if (!Number.isInteger(body.current_day) || body.current_day < 0 || body.current_day > 31) {
      return NextResponse.json({ error: "current_day must be an integer between 0 and 31" }, { status: 400 });
    }
    update.current_day = body.current_day;
  }
  if (body.notes !== undefined) {
    update.notes = body.notes;
  }
  if (body.ai_paused !== undefined) {
    update.ai_paused = body.ai_paused;
  }
  if (body.onboarding_step !== undefined) {
    if (!VALID_ONBOARDING_STEPS.includes(body.onboarding_step)) {
      return NextResponse.json({ error: "Invalid onboarding_step" }, { status: 400 });
    }
    update.onboarding_step = body.onboarding_step;
  }
  if (body.first_name !== undefined) {
    update.first_name = typeof body.first_name === "string" ? body.first_name.trim().slice(0, 50) || null : null;
  }
  if (body.preferred_delivery_hour !== undefined) {
    if (
      body.preferred_delivery_hour !== null &&
      (!Number.isInteger(body.preferred_delivery_hour) ||
        body.preferred_delivery_hour < 0 ||
        body.preferred_delivery_hour > 23)
    ) {
      return NextResponse.json(
        { error: "preferred_delivery_hour must be an integer between 0 and 23, or null" },
        { status: 400 },
      );
    }
    update.preferred_delivery_hour = body.preferred_delivery_hour;
  }
  if (body.email_address !== undefined) {
    if (body.email_address !== null && !EMAIL_PATTERN.test(body.email_address)) {
      return NextResponse.json({ error: "email_address is not a valid email address" }, { status: 400 });
    }
    update.email_address = body.email_address;
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
