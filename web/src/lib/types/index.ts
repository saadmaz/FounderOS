/**
 * Core domain types. Firestore is schemaless, but every read/write in this
 * app goes through the repository layer (src/lib/data/*), which is typed
 * against these - the UI never sees a raw Firestore document.
 */

export type Role = "owner" | "admin" | "manager" | "employee" | "accountant" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  createdBy: string;
}

export interface WorkspaceMember {
  id: string; // == Firebase Auth uid
  workspaceId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: Role;
  createdAt: number;
}

export type CompanyStatus = "active" | "paused" | "archived" | "exploring";
export type CompanyStage = "idea" | "pre-launch" | "launched" | "growth" | "scaling" | "mature";
export type CompanyType = "startup" | "client" | "agency" | "personal" | "investment";

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  legalName?: string;
  industry?: string;
  type: CompanyType;
  status: CompanyStatus;
  stage: CompanyStage;
  currency: string;
  color: string; // hex accent used for badges/charts tied to this company
  website?: string;
  founder?: string;
  startedAt?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number | null;
}

export type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "completed"
  | "cancelled"
  | "on_hold";
export type Priority = "critical" | "high" | "medium" | "low";

export interface Project {
  id: string;
  workspaceId: string;
  companyId: string;
  name: string;
  description?: string;
  priority: Priority;
  status: ProjectStatus;
  ownerId?: string; // WorkspaceMember id
  estimatedHours?: number;
  startDate?: number;
  endDate?: number;
  createdAt: number;
  updatedAt: number;
}

export type TaskStatus = "not_started" | "in_progress" | "blocked" | "in_review" | "completed" | "cancelled";

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in_review", label: "In Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export interface Task {
  id: string;
  workspaceId: string;
  companyId: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  ownerId?: string;
  estimatedHours?: number;
  dueDate?: number | null;
  completedAt?: number | null;
  order: number; // for kanban column ordering
  createdAt: number;
  updatedAt: number;
}

export interface TimeEntry {
  id: string;
  workspaceId: string;
  companyId: string;
  taskId?: string;
  memberId: string;
  startedAt: number;
  endedAt: number | null; // null while a timer is running
  billable: boolean;
  note?: string;
  createdAt: number;
}
