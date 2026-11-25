"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { adminFetch } from "@/lib/admin-fetch";
import { GUIDELINES, type Guideline } from "@/lib/guidelines";
import type { BlogPostRow, CommunityPostRow } from "@/lib/supabase/types";

export function CommunityView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community &amp; Blog</h1>
        <p className="text-sm text-muted-foreground">
          Review what the screen held and what members reported, watch every conversation, and act on the{" "}
          <a href="/community-guidelines" className="underline" target="_blank">Community Guidelines</a>. Publish articles.
        </p>
      </div>

      <Tabs defaultValue="moderation">
        <TabsList>
          <TabsTrigger value="moderation">Community safety</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
        </TabsList>
        <TabsContent value="moderation" className="mt-4">
          <ModerationQueue />
        </TabsContent>
        <TabsContent value="blog" className="mt-4">
          <BlogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type AdminPost = CommunityPostRow & {
  groupName: string | null;
  groupKind: "friends" | "matched" | null;
  author: { name: string | null; status: string; strikes: number } | null;
  mediaURL: string | null;
  thumbURL: string | null;
};

type AdminPerson = {
  phone: string;
  name: string | null;
  status: string;
  pausedUntil: string | null;
  strikes: { id: string; guideline: string; note: string | null; source: string; severity: string; revoked_at: string | null; created_at: string }[];
  actions: { id: string; action: string; note: string | null; actor: string; created_at: string }[];
};

const VIEWS = [
  { key: "held", label: "Needs review" },
  { key: "reported", label: "Reported" },
  { key: "all", label: "Everything" },
  { key: "people", label: "People" },
] as const;

/**
 * Community safety: everything held by the screen or reported, every post
 * (to watch the conversations), a group's whole thread, and the people
 * whose standing isn't clean — with the ladder's actions built in
 * (lib/standing.ts, written out at /community-guidelines).
 */
function ModerationQueue() {
  const [view, setView] = useState<(typeof VIEWS)[number]["key"] | "group">("held");
  const [group, setGroup] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (view === "people") {
      setPeople((await adminFetch<{ people: AdminPerson[] }>("/api/admin/community/people")).people);
      return;
    }
    const params = new URLSearchParams({ view });
    if (view === "group" && group) params.set("group", group.id);
    if (search.trim()) params.set("q", search.trim());
    setPosts((await adminFetch<{ posts: AdminPost[] }>(`/api/admin/community?${params}`)).posts);
  }, [view, group, search]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function decide(post: AdminPost, action: "approve" | "remove" | "strike" | "flag", guideline?: Guideline, severe?: boolean) {
    const result = await adminFetch<{ outcome: string | null }>(`/api/admin/community/${post.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action, guideline, severe }),
    });
    setMessage(result.outcome ? `Strike recorded — outcome: ${result.outcome}.` : `Post ${action === "approve" ? "approved" : action === "flag" ? "kept held" : "removed"}.`);
    await load();
  }

  async function act(person: AdminPerson, action: "warn" | "pause" | "remove" | "suspend" | "restore") {
    const labels = { warn: "send a warning to", pause: "pause posting for 7 days for", remove: "remove from Community", suspend: "SUSPEND the account of", restore: "restore" };
    if (!window.confirm(`Are you sure you want to ${labels[action]} ${person.name ?? person.phone}?`)) return;
    await adminFetch("/api/admin/community/people", { method: "POST", body: JSON.stringify({ phone: person.phone, action }) });
    setMessage(`Done: ${action}.`);
    await load();
  }

  async function revoke(strikeId: string) {
    await adminFetch("/api/admin/community/people", { method: "POST", body: JSON.stringify({ action: "revoke", strikeId }) });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((item) => (
          <Button key={item.key} size="sm" variant={view === item.key ? "default" : "outline"} onClick={() => { setView(item.key); setGroup(null); }}>
            {item.label}
          </Button>
        ))}
        {group ? <Badge variant="secondary">Thread: {group.name}</Badge> : null}
        {view !== "people" ? (
          <Input className="ml-auto w-56" placeholder="Search words…" value={search} onChange={(event) => setSearch(event.target.value)} />
        ) : null}
      </div>
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {view === "people" ? (
        <div className="space-y-3">
          {people.map((person) => (
            <Card key={person.phone}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {person.name ?? "No name"} <span className="font-normal text-muted-foreground">{person.phone}</span>
                  </span>
                  <Badge variant={person.status === "active" ? "outline" : "destructive"}>
                    {person.status}
                    {person.pausedUntil ? ` until ${new Date(person.pausedUntil).toLocaleDateString()}` : ""}
                  </Badge>
                </div>
                <ul className="space-y-1 text-sm">
                  {person.strikes.map((strike) => (
                    <li key={strike.id} className={strike.revoked_at ? "text-muted-foreground line-through" : ""}>
                      {new Date(strike.created_at).toLocaleDateString()} · {GUIDELINES[strike.guideline as Guideline] ?? strike.guideline}
                      {strike.severity === "severe" ? " (severe)" : ""} · by {strike.source}
                      {strike.note ? ` — ${strike.note}` : ""}
                      {!strike.revoked_at ? (
                        <button className="ml-2 text-xs underline" onClick={() => revoke(strike.id)}>
                          revoke
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <details className="text-xs text-muted-foreground">
                  <summary>History ({person.actions.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {person.actions.map((action) => (
                      <li key={action.id}>
                        {new Date(action.created_at).toLocaleString()} · {action.action} by {action.actor}
                        {action.note ? ` — ${action.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => act(person, "warn")}>Warn</Button>
                  <Button size="sm" variant="outline" onClick={() => act(person, "pause")}>Pause 7 days</Button>
                  <Button size="sm" variant="outline" onClick={() => act(person, "remove")}>Remove from Community</Button>
                  <Button size="sm" variant="destructive" onClick={() => act(person, "suspend")}>Suspend account</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(person, "restore")}>Restore</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {people.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No one has a strike.</p> : null}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDecide={(action, guideline, severe) => decide(post, action, guideline, severe)}
              onThread={
                post.group_id
                  ? () => {
                      setGroup({ id: post.group_id!, name: post.groupName ?? "Group" });
                      setView("group");
                    }
                  : undefined
              }
            />
          ))}
          {posts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p> : null}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  onDecide,
  onThread,
}: {
  post: AdminPost;
  onDecide: (action: "approve" | "remove" | "strike" | "flag", guideline?: Guideline, severe?: boolean) => void;
  onThread?: () => void;
}) {
  const [guideline, setGuideline] = useState<Guideline>("kindness");
  const [severe, setSevere] = useState(false);
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {post.phone_number ? post.display_name ?? "Anonymous" : "Companion"}{" "}
            <span className="font-normal text-muted-foreground">{post.phone_number ?? ""}</span>
            {post.author && post.author.strikes > 0 ? (
              <span className="ml-2 text-xs text-destructive">{post.author.strikes} strike{post.author.strikes === 1 ? "" : "s"}</span>
            ) : null}
            {post.author && post.author.status !== "active" ? <span className="ml-2 text-xs text-destructive">{post.author.status}</span> : null}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {post.groupName ? <Badge variant="outline">{post.groupKind === "matched" ? "Matched" : "Friends"}: {post.groupName}</Badge> : <Badge variant="outline">Day wall</Badge>}
            {post.day_number !== null ? <Badge variant="outline">Day {post.day_number}</Badge> : null}
            {post.report_count > 0 ? <Badge variant="destructive">{post.report_count} reports</Badge> : null}
            <Badge>{post.status}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString()}</p>
        {post.content ? <p className="whitespace-pre-wrap text-sm">{post.content}</p> : null}
        {post.media && post.mediaURL ? (
          <div className="space-y-2">
            {post.media.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.mediaURL} alt="" className="max-h-72 rounded-md" />
            ) : post.media.kind === "video" ? (
              <video src={post.mediaURL} poster={post.thumbURL ?? undefined} controls className="max-h-72 rounded-md" />
            ) : (
              <audio src={post.mediaURL} controls />
            )}
            {post.media.transcript ? <p className="text-xs text-muted-foreground">Transcript: {post.media.transcript}</p> : null}
          </div>
        ) : null}
        {post.moderation_note ? <p className="text-xs text-muted-foreground">Screen: {post.moderation_note}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onDecide("approve")}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => onDecide("remove")}>Remove</Button>
          <Button size="sm" variant="outline" onClick={() => onDecide("flag")}>Keep held (distress)</Button>
          {post.phone_number ? (
            <span className="flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                value={guideline}
                onChange={(event) => setGuideline(event.target.value as Guideline)}
              >
                {Object.entries(GUIDELINES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={severe} onChange={(event) => setSevere(event.target.checked)} /> severe
              </label>
              <Button size="sm" variant="destructive" onClick={() => onDecide("strike", guideline, severe)}>
                Remove + strike
              </Button>
            </span>
          ) : null}
          {onThread ? (
            <Button size="sm" variant="ghost" onClick={onThread}>
              View thread
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BlogPanel() {
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const result = await adminFetch<{ posts: BlogPostRow[] }>("/api/admin/blog");
    setPosts(result.posts);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleCreate(status: "draft" | "published") {
    setCreating(true);
    setError(null);
    try {
      await adminFetch("/api/admin/blog", {
        method: "POST",
        body: JSON.stringify({ title, slug, content, media_url: mediaUrl || undefined, status }),
      });
      setTitle("");
      setSlug("");
      setContent("");
      setMediaUrl("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(post: BlogPostRow) {
    await adminFetch(`/api/admin/blog/${post.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: post.status === "published" ? "draft" : "published" }),
    });
    load();
  }

  async function remove(id: string) {
    await adminFetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New article</CardTitle>
          <CardDescription>Publish or save as a draft.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-slug">Slug</Label>
            <Input id="post-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="my-article" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-media">Media URL (embedded video / image)</Label>
            <Input id="post-media" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-content">Content</Label>
            <Textarea id="post-content" rows={8} value={content} onChange={(event) => setContent(event.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={creating || !title || !slug || !content}
              onClick={() => handleCreate("draft")}
            >
              Save draft
            </Button>
            <Button disabled={creating || !title || !slug || !content} onClick={() => handleCreate("published")}>
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium">{post.title}</p>
                <p className="text-xs text-muted-foreground">/{post.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={post.status === "published" ? "default" : "secondary"}>{post.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => togglePublish(post)}>
                  {post.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(post.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No articles yet.</p>
        ) : null}
      </div>
    </div>
  );
}
