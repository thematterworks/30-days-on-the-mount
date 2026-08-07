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
import type { BlogPostRow, CommunityPostRow } from "@/lib/supabase/types";

export function CommunityView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community &amp; Blog</h1>
        <p className="text-sm text-muted-foreground">Moderate reflections and publish articles.</p>
      </div>

      <Tabs defaultValue="moderation">
        <TabsList>
          <TabsTrigger value="moderation">Moderation Queue</TabsTrigger>
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

function ModerationQueue() {
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "flagged" | "deleted">("pending");

  const load = useCallback(async () => {
    const result = await adminFetch<{ posts: CommunityPostRow[] }>(`/api/admin/community?status=${filter}`);
    setPosts(result.posts);
  }, [filter]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function moderate(id: string, status: CommunityPostRow["status"]) {
    await adminFetch(`/api/admin/community/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "approved", "flagged", "deleted"] as const).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{post.phone_number}</span>
                <div className="flex items-center gap-2">
                  {post.day_number !== null ? <Badge variant="outline">Day {post.day_number}</Badge> : null}
                  <Badge>{post.status}</Badge>
                </div>
              </div>
              <p className="text-sm">{post.content}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => moderate(post.id, "approved")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => moderate(post.id, "flagged")}>
                  Flag
                </Button>
                <Button size="sm" variant="destructive" onClick={() => moderate(post.id, "deleted")}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing in this queue.</p>
        ) : null}
      </div>
    </div>
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
