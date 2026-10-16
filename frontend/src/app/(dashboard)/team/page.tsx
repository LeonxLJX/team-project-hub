"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Mail, Shield, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { teamApi, extractApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/types";
import { format } from "date-fns";

const ALL_ROLES: Role[] = [
  "ADMIN",
  "PROJECT_MANAGER",
  "DEVELOPER",
  "QA",
  "VIEWER",
];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  QA: "QA Engineer",
  VIEWER: "Viewer",
};

export default function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "DEVELOPER" as Role });

  const isAdmin = user?.role === "ADMIN";

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: teamApi.list,
  });

  const team = teams[0];

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["teams", team?.id, "members"],
    queryFn: () => teamApi.members(team!.id),
    enabled: !!team,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      teamApi.inviteMember(team!.id, invite.email, invite.role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teams", team?.id, "members"],
      });
      setInviteOpen(false);
      setInvite({ email: "", role: "DEVELOPER" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: Role;
    }) => teamApi.updateMemberRole(team!.id, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teams", team?.id, "members"],
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      teamApi.removeMember(team!.id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teams", team?.id, "members"],
      });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage team members and their roles.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your team.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inv-email">Email Address</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={invite.email}
                    onChange={(e) =>
                      setInvite({ ...invite, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={invite.role}
                    onValueChange={(v) =>
                      setInvite({ ...invite, role: v as Role })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {inviteMutation.isError && (
                  <p className="text-xs text-destructive">
                    {extractApiError(inviteMutation.error)}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending
                      ? "Sending invite…"
                      : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Role legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role Permissions</CardTitle>
          <CardDescription className="text-xs">
            Summary of what each role can do in the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ALL_ROLES.map((r) => (
              <div key={r} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-medium">{ROLE_LABEL[r]}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {roleDescription(r)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Members table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 5 : 4}
                    className="text-center text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && members.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 5 : 4}
                    className="text-center text-muted-foreground"
                  >
                    No members yet.
                  </TableCell>
                </TableRow>
              )}
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{m.user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {m.user.email}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          updateRoleMutation.mutate({
                            memberId: m.id,
                            role: v as Role,
                          })
                        }
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{ROLE_LABEL[m.role]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(m.user.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {m.role !== "ADMIN" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeMutation.mutate(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function roleDescription(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "Full access: manage teams, users, projects, and all resources.";
    case "PROJECT_MANAGER":
      return "Create & manage projects, review work logs, assign tasks.";
    case "DEVELOPER":
      return "Work on tasks, log hours, upload file versions.";
    case "QA":
      return "Test tasks, log hours, comment, upload files.";
    case "VIEWER":
      return "Read-only access to projects, tasks, and reports.";
  }
}
