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

export type CompanyType =
  | "startup"
  | "company"
  | "agency"
  | "client"
  | "work"
  | "side_project"
  | "nonprofit"
  | "investment"
  | "personal";

export const COMPANY_TYPES: { value: CompanyType; label: string; description: string }[] = [
  { value: "startup", label: "Startup", description: "A new venture built for high growth." },
  { value: "company", label: "Company", description: "An established, steady-state business." },
  { value: "agency", label: "Agency", description: "A service business you run for clients." },
  { value: "client", label: "Client", description: "Someone you do paid work for, not your own venture." },
  { value: "work", label: "Work", description: "Your day job or employer." },
  { value: "side_project", label: "Side Project", description: "Something you're building on the side." },
  { value: "nonprofit", label: "Nonprofit", description: "A nonprofit or foundation." },
  { value: "investment", label: "Investment", description: "A company you've invested in or advise." },
  { value: "personal", label: "Personal", description: "Personal projects and life admin." },
];

export interface CompanyLinks {
  website?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  other?: string;
}

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
  logoUrl?: string;
  description?: string;
  founder?: string;
  startedAt?: number;
  links?: CompanyLinks;
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
export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in_review", label: "In Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "on_hold", label: "On Hold" },
];

export type Priority = "critical" | "high" | "medium" | "low";

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

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
  projectId?: string;
  taskId?: string;
  memberId: string;
  /** What this entry reads as at a glance (task title, project name, company
   * name, or a freeform note) - denormalized at write time so anything that
   * lists entries (topbar, tables) can show it without joining three more
   * collections. */
  subjectLabel?: string;
  startedAt: number;
  endedAt: number | null; // null while a timer is running
  billable: boolean;
  note?: string;
  createdAt: number;
}

/** A day marked as not-working for a "work" (day job) company - keeps
 * clocked hours honest by excluding days off from work-hour totals instead
 * of just leaving a gap that reads as a missed clock-in. One per
 * company+date; see markTimeOff in lib/data/time-off.ts. */
export type TimeOffReason = "vacation" | "sick" | "holiday" | "personal" | "other";

export const TIME_OFF_REASONS: { value: TimeOffReason; label: string }[] = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "holiday", label: "Holiday" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

export interface TimeOffEntry {
  id: string;
  workspaceId: string;
  companyId: string;
  memberId: string;
  /** Midnight (local) of the day marked off - dates, not timestamps, since
   * a day off isn't a duration. */
  date: number;
  reason: TimeOffReason;
  note?: string;
  createdAt: number;
}

// ===================== Finance =====================

export type ExpenseCategory =
  | "software"
  | "payroll"
  | "marketing"
  | "office"
  | "travel"
  | "legal"
  | "other";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "software", label: "Software" },
  { value: "payroll", label: "Payroll" },
  { value: "marketing", label: "Marketing" },
  { value: "office", label: "Office" },
  { value: "travel", label: "Travel" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
];

// Pending -> Approved -> Reimbursed (or Rejected, if the company won't be
// covering it) - this tracks *you* getting paid back for money you put in,
// not a company-side payment workflow.
export type ExpenseStatus = "pending" | "approved" | "reimbursed" | "rejected";

export const EXPENSE_STATUSES: { value: ExpenseStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "reimbursed", label: "Reimbursed" },
  { value: "rejected", label: "Rejected" },
];

/** A receipt uploaded to Cloudinary and attached to an expense. publicId +
 * resourceType are kept (not just the url) because deleting a Cloudinary
 * asset later needs both. */
export interface FinanceAttachment {
  url: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  name: string;
  size: number;
}

/**
 * Money *you* put in on a company's behalf - this app tracks what you do
 * for a company, not the company's own books (its revenue/client invoicing
 * live in whatever system runs that side of the business). `status` is
 * about whether you're getting this back, not whether a bill got paid.
 */
export interface Expense {
  id: string;
  workspaceId: string;
  companyId: string;
  /** What the expense was for, e.g. "AWS hosting" - the scannable label a
   * list of expenses is read by. Required: unlike `description` (extra
   * detail), an expense with no name at all isn't useful in a list. */
  title: string;
  /** Free-text vendor/payee name - typed directly on the expense rather
   * than linked to a Vendor record, so logging an expense never depends on
   * a vendor having been created first. Separate from the Vendor entity
   * (src/lib/data/vendors.ts), which still exists for tracking contact
   * info on who you regularly pay. */
  vendor?: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: number;
  description?: string;
  status: ExpenseStatus;
  receipts?: FinanceAttachment[];
  createdBy: string; // WorkspaceMember id
  createdAt: number;
  updatedAt: number;
}

export type BudgetPeriod = "monthly" | "quarterly" | "yearly";

export const BUDGET_PERIODS: { value: BudgetPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export interface Budget {
  id: string;
  workspaceId: string;
  companyId: string;
  category: ExpenseCategory;
  period: BudgetPeriod;
  periodStart: number;
  allocatedAmount: number;
  currency: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Vendor {
  id: string;
  workspaceId: string;
  companyId: string;
  name: string;
  category?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type InvestmentType =
  | "equity"
  | "safe"
  | "convertible_note"
  | "debt"
  | "real_estate"
  | "stocks"
  | "crypto"
  | "fund"
  | "other";

export const INVESTMENT_TYPES: { value: InvestmentType; label: string }[] = [
  { value: "equity", label: "Equity" },
  { value: "safe", label: "SAFE" },
  { value: "convertible_note", label: "Convertible Note" },
  { value: "debt", label: "Debt" },
  { value: "real_estate", label: "Real Estate" },
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
  { value: "fund", label: "Fund" },
  { value: "other", label: "Other" },
];

export type InvestmentStatus = "active" | "exited" | "written_off";

export const INVESTMENT_STATUSES: { value: InvestmentStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "exited", label: "Exited" },
  { value: "written_off", label: "Written Off" },
];

/** Capital *you* put into a company/asset - `currentValue` is optional and
 * separate from `amount` (what was put in) so gain/loss can be shown once
 * it's known. */
export interface Investment {
  id: string;
  workspaceId: string;
  companyId: string;
  type: InvestmentType;
  status: InvestmentStatus;
  amount: number;
  currency: string;
  date: number;
  currentValue?: number;
  ownershipPercent?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// ===================== CRM =====================

export type ContactStatus = "active" | "inactive";

export interface Contact {
  id: string;
  workspaceId: string;
  companyId: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status: ContactStatus;
  lastContactedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export const DEAL_STAGES: { value: DealStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export interface Deal {
  id: string;
  workspaceId: string;
  companyId: string;
  contactId?: string;
  title: string;
  value: number;
  currency: string;
  stage: DealStage;
  probability?: number; // 0-100
  expectedCloseDate?: number | null;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ===================== Documents =====================

export interface DocumentFile {
  id: string;
  workspaceId: string;
  companyId?: string;
  name: string;
  description?: string;
  url: string; // Cloudinary secure_url - stable, safe to use directly
  publicId: string; // Cloudinary public_id, needed to delete the asset later
  resourceType: "image" | "video" | "raw"; // Cloudinary's asset bucket, needed to delete it
  contentType: string;
  size: number;
  uploadedBy: string; // WorkspaceMember id
  createdAt: number;
}

// ===================== Recurrence =====================
// Shared by calendar events and meetings. There's no background job in this
// app to expand a recurrence rule lazily, so a recurring series is
// materialized as N real documents up front (see src/lib/recurrence.ts) -
// each one denormalizes this so it can say "I'm 3 of 12, weekly" and so
// deleting the whole series can find its siblings via groupId.

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export const RECURRENCE_FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval: number; // every N days/weeks/months
  groupId: string; // shared across every instance in the series
  index: number; // 0-based position of this instance within the series
  count: number; // total instances generated for the series
}

// ===================== Calendar =====================

export type CalendarEventType = "event" | "deadline" | "reminder";

export interface CalendarEvent {
  id: string;
  workspaceId: string;
  companyId?: string;
  title: string;
  type: CalendarEventType;
  startsAt: number;
  endsAt?: number | null;
  allDay: boolean;
  notes?: string;
  recurrence?: Recurrence;
  createdBy: string;
  createdAt: number;
}

// ===================== Meetings =====================

export type MeetingStatus = "scheduled" | "completed" | "cancelled";

export const MEETING_STATUSES: { value: MeetingStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export interface Meeting {
  id: string;
  workspaceId: string;
  companyId: string;
  title: string;
  scheduledAt: number;
  durationMinutes: number;
  attendeeIds: string[]; // WorkspaceMember ids
  location?: string;
  agenda?: string;
  notes?: string;
  status: MeetingStatus;
  recurrence?: Recurrence;
  createdAt: number;
  updatedAt: number;
}

// ===================== Goals =====================

export type GoalStatus = "not_started" | "in_progress" | "completed" | "missed";

export const GOAL_STATUSES: { value: GoalStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
];

export type GoalCategory = "revenue" | "growth" | "product" | "personal" | "other";

export const GOAL_CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: "revenue", label: "Revenue" },
  { value: "growth", label: "Growth" },
  { value: "product", label: "Product" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

export interface Goal {
  id: string;
  workspaceId: string;
  companyId?: string;
  title: string;
  description?: string;
  category: GoalCategory;
  status: GoalStatus;
  targetValue?: number;
  currentValue?: number;
  unit?: string; // e.g. "$", "customers", "%"
  targetDate?: number | null;
  createdAt: number;
  updatedAt: number;
}

// ===================== Ideas =====================

export type IdeaStatus = "new" | "considering" | "planned" | "in_progress" | "shipped" | "rejected";

export const IDEA_STATUSES: { value: IdeaStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "considering", label: "Considering" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "shipped", label: "Shipped" },
  { value: "rejected", label: "Rejected" },
];

export interface Idea {
  id: string;
  workspaceId: string;
  companyId?: string;
  title: string;
  description?: string;
  status: IdeaStatus;
  votes: number;
  tags?: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ===================== Learning =====================

export type LearningType = "book" | "course" | "article" | "podcast" | "video" | "other";

export const LEARNING_TYPES: { value: LearningType; label: string }[] = [
  { value: "book", label: "Book" },
  { value: "course", label: "Course" },
  { value: "article", label: "Article" },
  { value: "podcast", label: "Podcast" },
  { value: "video", label: "Video" },
  { value: "other", label: "Other" },
];

export type LearningStatus = "queued" | "in_progress" | "completed";

export const LEARNING_STATUSES: { value: LearningStatus; label: string }[] = [
  { value: "queued", label: "Queued" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export interface LearningItem {
  id: string;
  workspaceId: string;
  title: string;
  type: LearningType;
  status: LearningStatus;
  url?: string;
  notes?: string;
  rating?: number; // 1-5
  createdAt: number;
  updatedAt: number;
}
