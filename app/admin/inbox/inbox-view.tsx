"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { adminFetch } from "@/lib/admin-fetch";
import { Bot, Send, User as UserIcon } from "lucide-react";
import type { MessageLogRow, UserRow } from "@/lib/supabase/types";

interface Conversation {
  phone_number: string;
  status: UserRow["status"];
  current_day: number;
  last_interaction_at: string;
  ai_paused: boolean;
  lastMessage: { message_body: string; direction: string; created_at: string } | null;
}

export function InboxView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<{ user: UserRow; messages: MessageLogRow[] } | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const result = await adminFetch<{ conversations: Conversation[] }>("/api/admin/inbox");
      setConversations(result.conversations);
    } catch {
      // transient — retried on next interval
    }
  }, []);

  const loadThread = useCallback(async (phone: string) => {
    try {
      const result = await adminFetch<{ user: UserRow; messages: MessageLogRow[] }>(
        `/api/admin/inbox/${encodeURIComponent(phone)}`,
      );
      setThread(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadConversations();
    })();
    const interval = setInterval(loadConversations, 10_000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selected) return;
    void (async () => {
      await loadThread(selected);
    })();
    const interval = setInterval(() => loadThread(selected), 5_000);
    return () => clearInterval(interval);
  }, [selected, loadThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread]);

  async function handleSend() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/users/${encodeURIComponent(selected)}/send`, {
        method: "POST",
        body: JSON.stringify({ message: draft }),
      });
      setDraft("");
      await loadThread(selected);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleTogglePauseAi(nextValue: boolean) {
    if (!selected) return;
    await adminFetch(`/api/admin/users/${encodeURIComponent(selected)}`, {
      method: "PATCH",
      body: JSON.stringify({ ai_paused: nextValue }),
    });
    await loadThread(selected);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Live Conversation Inbox</h1>
        <p className="text-sm text-muted-foreground">Reflections, automated prompts, and AI replies — in one place.</p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden rounded-lg border border-border md:grid-cols-[280px_1fr]">
        <div className="flex flex-col overflow-hidden border-r border-border">
          <ScrollArea className="flex-1">
            <div className="divide-y divide-border">
              {conversations.map((c) => (
                <button
                  key={c.phone_number}
                  onClick={() => setSelected(c.phone_number)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-accent",
                    selected === c.phone_number && "bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.phone_number}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Day {c.current_day}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {c.lastMessage?.message_body ?? "No messages yet"}
                  </p>
                </button>
              ))}
              {conversations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No participants yet.</p>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <div className="flex flex-col overflow-hidden">
          {!selected || !thread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a conversation to view the history.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{thread.user.phone_number}</p>
                  <p className="text-xs text-muted-foreground">
                    Day {thread.user.current_day} &middot; {thread.user.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="pause-ai" className="text-xs text-muted-foreground">
                    Pause AI
                  </Label>
                  <Switch
                    id="pause-ai"
                    checked={thread.user.ai_paused}
                    onCheckedChange={handleTogglePauseAi}
                  />
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-3">
                  {thread.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </div>
              </div>

              <div className="border-t border-border p-3">
                {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Send a message as the admin, overriding the AI..."
                    className="min-h-[44px] resize-none"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button onClick={handleSend} disabled={sending || !draft.trim()} size="icon" className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageLogRow }) {
  const inbound = message.direction === "inbound";
  const ai = message.message_type === "ai_generated";
  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          inbound ? "bg-muted text-foreground" : ai ? "bg-primary/15 text-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-70">
          {inbound ? <UserIcon className="h-3 w-3" /> : ai ? <Bot className="h-3 w-3" /> : null}
          {inbound ? "Participant" : ai ? "AI reply" : message.message_type === "template" ? "Template" : "Admin"}
        </div>
        <p className="whitespace-pre-wrap">{message.message_body}</p>
      </div>
    </div>
  );
}
