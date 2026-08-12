"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  BookOpen,
  Newspaper,
  Mountain,
  Palette,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Analytics", icon: LayoutDashboard },
  { href: "/admin/inbox", label: "Inbox", icon: MessagesSquare },
  { href: "/admin/participants", label: "Participants", icon: Users },
  { href: "/admin/curriculum", label: "Curriculum & AI", icon: BookOpen },
  { href: "/admin/community", label: "Community & Blog", icon: Newspaper },
  { href: "/admin/email-settings", label: "Email Design", icon: Palette },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
          <Mountain className="h-4 w-4 text-primary" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">30 Days on the Mount</div>
          <div className="text-xs text-muted-foreground">Command Center</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
