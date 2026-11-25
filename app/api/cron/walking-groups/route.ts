import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { tendGroups } from "@/lib/matching";

export const maxDuration = 300;

/**
 * Walking groups, hourly (.github/workflows/scheduled-messaging.yml): forms
 * matched groups for whoever is waiting, and once a day nudges quiet groups
 * and folds dwindled ones together (lib/matching.ts). App notifications only.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await tendGroups());
  } catch (error) {
    console.error("Tending walking groups failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
