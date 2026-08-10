"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mountain } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Login failed");
        return;
      }

      // The session cookie is already set on the browser by the time this
      // fetch resolves. router.refresh() invalidates the Next.js Router
      // Cache *before* we navigate, so /admin re-runs proxy.ts and
      // re-fetches its Server Components against the fresh cookie instead
      // of potentially replaying a cached redirect-to-login response from
      // before you were authenticated.
      router.refresh();
      router.push(searchParams.get("next") || "/admin");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      // Always release the button, even if navigation stalls for any
      // reason — previously this only ran on the error path, so a stalled
      // redirect left the form stuck on "Signing in..." with no way out.
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm border-border/60">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Mountain className="h-5 w-5 text-primary" />
        </div>
        <CardTitle>30 Days on the Mount</CardTitle>
        <CardDescription>Sign in to the command center.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
