"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Upload, Send, MessageSquare, Paperclip } from "lucide-react";
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
  userApi,
  extractApiError,
} from "@/lib/api-client";
import type {
  Priority,
  Task,
  TaskStatus,
  User,
} from "@/types";
import { format } from "date-fns";

const PRIORITY_BADGE: Record<Priority, "secondary" | "info" | "warning" | "destructive"> = {
  LOW: "secondary",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

const STATUS_BADGE: Record<TaskStatus, "secondary" | "info" | "warning" | "success"> = {
  TODO: "secondary",
  IN_PROGRESS: "info",
  BLOCKED: "warning",
  DONE: "success",
};

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TaskStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [assigneeId, setAssigneeId] = useState<string>("ALL");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectApi.list,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: userApi.list,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", { status, priority, assigneeId }],
    queryFn: () =>
      taskApi.list({
        status: status === "ALL" ? undefined : status,
        priority: priority === "ALL" ? undefined : priority,
        assigneeId: assigneeId === "ALL" ? undefined : assigneeId,
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all tasks across projects.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filters:
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as TaskStatus | "ALL")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="TODO">TODO</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="DONE">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority | "ALL")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No tasks match your filters.
                  </TableCell>
                </TableRow>
              )}
              {tasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedTask(task)}
                  >
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {project?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[task.status]}>
                        {task.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_BADGE[task.priority]}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.assignee?.name ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.dueDate
                        ? format(new Date(task.dueDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={() =>
            queryClient.invalidateQueries({ queryKey: ["tasks"] })
          }
        />
      )}
    </div>
  );
}

function TaskDetailDialog({
  task,
  users,
  onClose,
  onUpdate,
}: {
  task: Task;
  users: User[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ["tasks", task.id, "comments"],
    queryFn: () => taskApi.comments(task.id),
  });

  const { data: files = [] } = useQuery({
    queryKey: ["tasks", task.id, "files"],
    queryFn: () => taskApi.fileVersions(task.id),
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => taskApi.addComment(task.id, content),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "comments"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Task>) => taskApi.update(task.id, data),
    onSuccess: () => {
      onUpdate();
      queryClient.invalidateQueries({ queryKey: ["tasks", task.id] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (fd: FormData) => taskApi.uploadFile(task.id, fd),
    onSuccess: () => {
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "files"] });
    },
  });

  const handleUpload = () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    uploadMutation.mutate(fd);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>
            Created {format(new Date(task.createdAt), "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Main */}
          <div className="space-y-4 md:col-span-2">
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm">{task.description ?? "No description"}</p>
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                Comments ({comments.length})
              </Label>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-md border p-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {c.author?.name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.createdAt), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <p className="mt-1">{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="min-h-[60px]"
                />
                <Button
                  size="icon"
                  onClick={() => comment && addCommentMutation.mutate(comment)}
                  disabled={!comment || addCommentMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* File versions */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                Files / Versions
              </Label>
              <div className="space-y-1">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{f.fileName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        v{f.version} · {(f.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <a
                      href={f.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Download
                    </a>
                  </div>
                ))}
                {files.length === 0 && (
                  <p className="text-xs text-muted-foreground">No files uploaded.</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={!file || uploadMutation.isPending}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  Upload
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={task.status}
                onValueChange={(v) =>
                  updateMutation.mutate({ status: v as TaskStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select
                value={task.priority}
                onValueChange={(v) =>
                  updateMutation.mutate({ priority: v as Priority })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Assignee</Label>
              <Select
                value={task.assigneeId ?? ""}
                onValueChange={(v) => updateMutation.mutate({ assigneeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {updateMutation.isError && (
          <p className="text-xs text-destructive">
            {extractApiError(updateMutation.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
