"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Plus, ArrowLeft, Clock, Users, CheckCircle2, ListTodo, Loader2 } from "lucide-react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  projectApi,
  taskApi,
  userApi,
  extractApiError,
} from "@/lib/api-client";
import type { Priority, Task, TaskStatus } from "@/types";
import { format } from "date-fns";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To Do" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "BLOCKED", label: "Blocked" },
  { id: "DONE", label: "Done" },
];

const STATUS_BADGE: Record<TaskStatus, "secondary" | "info" | "warning" | "success"> = {
  TODO: "secondary",
  IN_PROGRESS: "info",
  BLOCKED: "warning",
  DONE: "success",
};

const PRIORITY_BADGE: Record<Priority, "secondary" | "info" | "warning" | "destructive"> = {
  LOW: "secondary",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [taskOpen, setTaskOpen] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => projectApi.get(projectId),
    enabled: !!projectId,
  });

  const { data: stats } = useQuery({
    queryKey: ["projects", projectId, "stats"],
    queryFn: () => projectApi.stats(projectId),
    enabled: !!projectId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => projectApi.members(projectId),
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: userApi.list,
  });

  const createTaskMutation = useMutation({
    mutationFn: taskApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      setTaskOpen(false);
      setTaskForm({
        title: "",
        description: "",
        priority: "MEDIUM",
        status: "TODO",
        assigneeId: "",
        dueDate: "",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      taskApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Priority,
    status: "TODO" as TaskStatus,
    assigneeId: "",
    dueDate: "",
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    createTaskMutation.mutate({
      title: taskForm.title,
      description: taskForm.description,
      projectId,
      priority: taskForm.priority,
      status: taskForm.status,
      assigneeId: taskForm.assigneeId || undefined,
      dueDate: taskForm.dueDate || undefined,
    });
  };

  const moveTask = (task: Task, status: TaskStatus) => {
    updateTaskMutation.mutate({ id: task.id, data: { status } });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Project not found.
      </div>
    );
  }

  const tasks = project.tasks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-sm text-muted-foreground">
              {project.description ?? "No description"}
            </p>
          </div>
        </div>
        <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
              <DialogDescription>
                Add a new task to this project.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t-title">Title</Label>
                <Input
                  id="t-title"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-desc">Description</Label>
                <Textarea
                  id="t-desc"
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={taskForm.status}
                    onValueChange={(v) =>
                      setTaskForm({ ...taskForm, status: v as TaskStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={taskForm.priority}
                    onValueChange={(v) =>
                      setTaskForm({ ...taskForm, priority: v as Priority })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map(
                        (p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Select
                    value={taskForm.assigneeId}
                    onValueChange={(v) =>
                      setTaskForm({ ...taskForm, assigneeId: v })
                    }
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
                <div className="space-y-2">
                  <Label htmlFor="t-due">Due Date</Label>
                  <Input
                    id="t-due"
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, dueDate: e.target.value })
                    }
                  />
                </div>
              </div>
              {createTaskMutation.isError && (
                <p className="text-xs text-destructive">
                  {extractApiError(createTaskMutation.error)}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTaskOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending ? "Creating…" : "Create Task"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={<ListTodo className="h-5 w-5" />}
            label="Total Tasks"
            value={stats.totalTasks}
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-sky-500" />}
            label="In Progress"
            value={stats.inProgressTasks}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            label="Done"
            value={stats.doneTasks}
          />
          <StatCard
            icon={<Users className="h-5 w-5 text-violet-500" />}
            label="Members"
            value={stats.memberCount}
          />
        </div>
      )}

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="board">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className="flex flex-col rounded-lg border bg-muted/30 p-3"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{col.label}</h3>
                    <Badge variant="secondary">{colTasks.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onMove={(s) => moveTask(task, s)}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm font-medium">Team: </span>
                <span className="text-sm text-muted-foreground">
                  {project.team?.name ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium">Created: </span>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(project.createdAt), "MMMM d, yyyy")}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium">Members ({members.length}):</span>
                <ul className="mt-2 space-y-1">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{m.user.name}</span>
                      <Badge variant="outline" className="capitalize">
                        {m.role.toLowerCase().replace("_", " ")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({
  task,
  onMove,
}: {
  task: Task;
  onMove: (status: TaskStatus) => void;
}) {
  return (
    <Card className="cursor-pointer">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{task.title}</p>
          <Badge variant={PRIORITY_BADGE[task.priority]}>{task.priority}</Badge>
        </div>
        {task.assignee && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium">
              {task.assignee.name.charAt(0)}
            </div>
            {task.assignee.name}
          </div>
        )}
        {task.dueDate && (
          <p className="text-xs text-muted-foreground">
            Due {format(new Date(task.dueDate), "MMM d")}
          </p>
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          {COLUMNS.filter((c) => c.id !== task.status).map((c) => (
            <button
              key={c.id}
              onClick={() => onMove(c.id)}
              className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
            >
              → {c.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
