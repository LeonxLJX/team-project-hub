// ============================================================================
// Domain Types — mirrors the Prisma schema for the Team Project Hub platform
// ============================================================================

export type Role =
  | "ADMIN"
  | "PROJECT_MANAGER"
  | "DEVELOPER"
  | "QA"
  | "VIEWER";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type WorkLogStatus = "PENDING" | "APPROVED" | "REJECTED";

export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_UPDATED"
  | "WORK_LOG_SUBMITTED"
  | "WORK_LOG_REVIEWED"
  | "PROJECT_CREATED"
  | "COMMENT"
  | "INVITE";

// ----------------------------------------------------------------------------
// User & Membership
// ----------------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: Role;
  user: User;
}

// ----------------------------------------------------------------------------
// Project
// ----------------------------------------------------------------------------
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: TaskStatus;
  teamId: string;
  team?: Team;
  createdById: string;
  createdBy?: User;
  tasks: Task[];
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: Role;
  user: User;
}

// ----------------------------------------------------------------------------
// Task
// ----------------------------------------------------------------------------
export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  projectId: string;
  project?: Project;
  assigneeId?: string | null;
  assignee?: User | null;
  reporterId: string;
  reporter?: User;
  comments: Comment[];
  fileVersions: FileVersion[];
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Work Log
// ----------------------------------------------------------------------------
export interface WorkLog {
  id: string;
  userId: string;
  user?: User;
  taskId: string;
  task?: Task;
  projectId: string;
  project?: Project;
  date: string;
  hours: number;
  description: string;
  status: WorkLogStatus;
  reviewedById?: string | null;
  reviewedBy?: User | null;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// File Version
// ----------------------------------------------------------------------------
export interface FileVersion {
  id: string;
  taskId: string;
  task?: Task;
  uploaderId: string;
  uploader?: User;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Comment & Notification
// ----------------------------------------------------------------------------
export interface Comment {
  id: string;
  taskId: string;
  task?: Task;
  authorId: string;
  author?: User;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  user?: User;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Auth payloads
// ----------------------------------------------------------------------------
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  teamName?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ----------------------------------------------------------------------------
// Generic API helpers
// ----------------------------------------------------------------------------
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// ----------------------------------------------------------------------------
// Dashboard stats (used by project detail & reports)
// ----------------------------------------------------------------------------
export interface ProjectStats {
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  totalHours: number;
  memberCount: number;
}

export interface WorkloadDatum {
  name: string;
  hours: number;
}

export interface ProjectHoursDatum {
  name: string;
  hours: number;
}
