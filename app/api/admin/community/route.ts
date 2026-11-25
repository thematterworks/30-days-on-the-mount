import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { type AdminView, adminPosts } from "@/lib/admin-community";

const VIEWS: AdminView[] = ["held", "reported", "all", "group"];

/** Community posts for review: held, reported, everything, or one group's thread. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const view = (VIEWS.find((item) => item === params.get("view")) ?? "held") as AdminView;
  const posts = await adminPosts(view, { groupId: params.get("group") ?? undefined, search: params.get("q") ?? undefined });
  return NextResponse.json({ posts });
}
