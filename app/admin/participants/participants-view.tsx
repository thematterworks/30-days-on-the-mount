"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminFetch } from "@/lib/admin-fetch";
import type { UserRow, UserStatus } from "@/lib/supabase/types";
import { ParticipantDialog } from "./participant-dialog";

const STATUS_VARIANT: Record<UserStatus, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
  opted_out: "destructive",
};

export function ParticipantsView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (search) params.set("search", search);
    const result = await adminFetch<{ users: UserRow[] }>(`/api/admin/users?${params.toString()}`);
    setUsers(result.users);
  }, [status, search]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Participant Management</h1>
        <p className="text-sm text-muted-foreground">Search, filter, and act on any participant.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search phone number..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="opted_out">Opted out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.phone_number}>
                <TableCell className="font-medium">{user.phone_number}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[user.status]}>{user.status}</Badge>
                </TableCell>
                <TableCell>{user.current_day}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(user.last_interaction_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setSelectedUser(user)}>
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No participants match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {selectedUser ? (
        <ParticipantDialog
          user={selectedUser}
          open={!!selectedUser}
          onOpenChange={(open) => !open && setSelectedUser(null)}
          onUpdated={load}
        />
      ) : null}
    </div>
  );
}
