import axios, { AxiosError, AxiosInstance } from "axios";
import type {
  AuthResponse,
  Comment,
  FileVersion,
  LoginPayload,
  Notification,
  PaginatedResponse,
  Priority,
  Project,
  ProjectMember,
  ProjectStats,
  ProjectHoursDatum,
  RegisterPayload,
  Role,
  Task,
  TaskStatus,
  Team,
  TeamMember,
  User,
  WorkLog,
  WorkLogStatus,
  WorkloadDatum,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Token helpers ----------------------------------------------------------------
const TOKEN_KEY = "tph_token";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string) => {
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  window.localStorage.removeItem(TOKEN_KEY);
};

// Axios instance ---------------------------------------------------------------
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Attach JWT on every request
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// 401 → wipe token (UI can redirect to login via the AuthProvider effect)
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(error);
  },
);

// ============================================================================
// Auth
// ============================================================================
export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>("/auth/login", payload).then((r) => r.data),

  register: (payload: RegisterPayload) =>
    apiClient.post<AuthResponse>("/auth/register", payload).then((r) => r.data),

  me: () =>
    apiClient.get<User>("/auth/me").then((r) => r.data),

  logout: () => apiClient.post("/auth/logout").then((r) => r.data),
};

// ============================================================================
// Teams
// ============================================================================
export const teamApi = {
  list: () => apiClient.get<Team[]>("/teams").then((r) => r.data),
  create: (data: { name: string; description?: string }) =>
    apiClient.post<Team>("/teams", data).then((r) => r.data),
  members: (teamId: string) =>
    apiClient.get<TeamMember[]>(`/teams/${teamId}/members`).then((r) => r.data),
  inviteMember: (teamId: string, email: string, role: Role) =>
    apiClient
      .post<TeamMember>(`/teams/${teamId}/members`, { email, role })
      .then((r) => r.data),
  updateMemberRole: (teamId: string, memberId: string, role: Role) =>
    apiClient
      .patch<TeamMember>(`/teams/${teamId}/members/${memberId}`, { role })
      .then((r) => r.data),
  removeMember: (teamId: string, memberId: string) =>
    apiClient.delete(`/teams/${teamId}/members/${memberId}`).then((r) => r.data),
};

// ============================================================================
// Users
// ============================================================================
export const userApi = {
  list: () => apiClient.get<User[]>("/users").then((r) => r.data),
  update: (id: string, data: Partial<Pick<User, "name" | "avatarUrl" | "role">>) =>
    apiClient.patch<User>(`/users/${id}`, data).then((r) => r.data),
};

// ============================================================================
// Projects
// ============================================================================
export const projectApi = {
  list: (params?: { teamId?: string }) =>
    apiClient.get<Project[]>("/projects", { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Project>(`/projects/${id}`).then((r) => r.data),

  stats: (id: string) =>
    apiClient.get<ProjectStats>(`/projects/${id}/stats`).then((r) => r.data),

  create: (data: { name: string; description?: string; teamId: string }) =>
    apiClient.post<Project>("/projects", data).then((r) => r.data),

  update: (id: string, data: Partial<Pick<Project, "name" | "description" | "status">>) =>
    apiClient.patch<Project>(`/projects/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/projects/${id}`).then((r) => r.data),

  members: (id: string) =>
    apiClient.get<ProjectMember[]>(`/projects/${id}/members`).then((r) => r.data),

  addMember: (id: string, userId: string, role: Role) =>
    apiClient
      .post<ProjectMember>(`/projects/${id}/members`, { userId, role })
      .then((r) => r.data),
};

// ============================================================================
// Tasks
// ============================================================================
export const taskApi = {
  list: (params?: {
    projectId?: string;
    status?: TaskStatus;
    priority?: Priority;
    assigneeId?: string;
  }) =>
    apiClient.get<Task[]>("/tasks", { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Task>(`/tasks/${id}`).then((r) => r.data),

  create: (data: {
    title: string;
    description?: string;
    projectId: string;
    status?: TaskStatus;
    priority?: Priority;
    assigneeId?: string;
    dueDate?: string;
  }) => apiClient.post<Task>("/tasks", data).then((r) => r.data),

  update: (
    id: string,
    data: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "assigneeId" | "dueDate">>,
  ) => apiClient.patch<Task>(`/tasks/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/tasks/${id}`).then((r) => r.data),

  comments: (id: string) =>
    apiClient.get<Comment[]>(`/tasks/${id}/comments`).then((r) => r.data),

  addComment: (id: string, content: string) =>
    apiClient
      .post<Comment>(`/tasks/${id}/comments`, { content })
      .then((r) => r.data),

  fileVersions: (id: string) =>
    apiClient.get<FileVersion[]>(`/tasks/${id}/files`).then((r) => r.data),

  uploadFile: (id: string, formData: FormData) =>
    apiClient
      .post<FileVersion>(`/tasks/${id}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),
};

// ============================================================================
// Work Logs
// ============================================================================
export const workLogApi = {
  list: (params?: {
    userId?: string;
    projectId?: string;
    taskId?: string;
    status?: WorkLogStatus;
    startDate?: string;
    endDate?: string;
  }) =>
    apiClient.get<WorkLog[]>("/work-logs", { params }).then((r) => r.data),

  create: (data: {
    taskId: string;
    projectId: string;
    date: string;
    hours: number;
    description: string;
  }) => apiClient.post<WorkLog>("/work-logs", data).then((r) => r.data),

  update: (id: string, data: Partial<Pick<WorkLog, "hours" | "description" | "date">>) =>
    apiClient.patch<WorkLog>(`/work-logs/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/work-logs/${id}`).then((r) => r.data),

  review: (id: string, status: WorkLogStatus) =>
    apiClient
      .patch<WorkLog>(`/work-logs/${id}/review`, { status })
      .then((r) => r.data),
};

// ============================================================================
// Notifications
// ============================================================================
export const notificationApi = {
  list: (params?: { isRead?: boolean }) =>
    apiClient
      .get<PaginatedResponse<Notification>>("/notifications", { params })
      .then((r) => r.data),

  markAsRead: (id: string) =>
    apiClient.patch<Notification>(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    apiClient.post("/notifications/read-all").then((r) => r.data),

  unreadCount: () =>
    apiClient.get<{ count: number }>("/notifications/unread-count").then((r) => r.data),
};

// ============================================================================
// Reports / Analytics
// ============================================================================
export const reportsApi = {
  projectHours: (params?: { startDate?: string; endDate?: string }) =>
    apiClient
      .get<ProjectHoursDatum[]>("/reports/project-hours", { params })
      .then((r) => r.data),

  memberWorkload: (params?: { projectId?: string; startDate?: string; endDate?: string }) =>
    apiClient
      .get<WorkloadDatum[]>("/reports/member-workload", { params })
      .then((r) => r.data),
};

// Export a typed error extractor for UI toast messages
export function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(", ") : data.message;
    }
    return error.message;
  }
  return (error as Error)?.message ?? "An unexpected error occurred";
}
