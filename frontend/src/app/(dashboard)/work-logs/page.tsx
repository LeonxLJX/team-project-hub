"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Check, X, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  projectApi,
  taskApi,
  workLogApi,
  extractApiError,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { WorkLogStatus } from "@/types";
import { format } from "date-fns";

const STATUS_BADGE: Record<WorkLogStatus, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default function WorkLogsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    taskId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    hours: "",
    description: "",
  });

  const isAdmin = user?.role === "ADMIN" || user?.role === "PROJECT_MANAGER";

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectApi.list,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", { projectId: form.projectId }],
    queryFn: () => taskApi.list({ projectId: form.projectId }),
    enabled: !!form.projectId,
  });

  const { data: workLogs = [], isLoading } = useQuery({
    queryKey: ["work-logs"],
    queryFn: workLogApi.list,
  });

  const createMutation = useMutation({
    mutationFn: workLogApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-logs"] });
      setLogOpen(false);
      setForm({
        projectId: "",
        taskId: "",
        date: format(new Date(), "yyyy-MM-dd"),
        hours: "",
        description: "",
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkLogStatus }) =>
      workLogApi.review(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-logs"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      projectId: form.projectId,
      taskId: form.taskId,
      date: form.date,
      hours: parseFloat(form.hours),
      description: form.description,
    });
  };

  const totalHours = workLogs
    .filter((w) => w.status === "APPROVED")
    .reduce((sum, w) => sum + w.hours, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Work Logs</h1>
          <p className="text-sm text-muted-foreground">
            Log your work hours and track time spent on tasks.
          </p>
        </div>
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Log Hours
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Work Hours</DialogTitle>
              <DialogDescription>
                Record the time you spent on a task.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) =>
                    setForm({ ...form, projectId: v, taskId: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Task</Label>
                <Select
                  value={form.taskId}
                  onValueChange={(v) => setForm({ ...form, taskId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wl-date">Date</Label>
                  <Input
                    id="wl-date"
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wl-hours">Hours</Label>
                  <Input
                    id="wl-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.hours}
                    onChange={(e) =>
                      setForm({ ...form, hours: e.target.value })
                    }
                    placeholder="8"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-desc">Description</Label>
                <Textarea
                  id="wl-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="What did you work on?"
                  required
                />
              </div>
              {createMutation.isError && (
                <p className="text-xs text-destructive">
                  {extractApiError(createMutation.error)}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Submitting…" : "Submit Log"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Logs</p>
            <p className="text-2xl font-bold">{workLogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Approved Hours</p>
            <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold">
              {workLogs.filter((w) => w.status === "PENDING").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Work logs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Work Logs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 7 : 6}
                    className="text-center text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && workLogs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 7 : 6}
                    className="text-center text-muted-foreground"
                  >
                    No work logs yet.
                  </TableCell>
                </TableRow>
              )}
              {workLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.user?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {log.task?.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(log.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">{log.hours}h</TableCell>
                  <TableCell className="max-w-[300px] truncate text-muted-foreground">
                    {log.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[log.status]}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {log.status === "PENDING" ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                            onClick={() =>
                              reviewMutation.mutate({
                                id: log.id,
                                status: "APPROVED",
                              })
                            }
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() =>
                              reviewMutation.mutate({
                                id: log.id,
                                status: "REJECTED",
                              })
                            }
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Reviewed
                        </span>
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
