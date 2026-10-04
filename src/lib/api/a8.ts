import { api, type Page } from "./client";
import { config } from "@/lib/config";
import { mock } from "@/lib/mock/a8";

// Staff screens for features the backend does not have yet. Every contract below is a PROPOSAL, written down in
// docs/BACKEND_NEEDS.md. While NEXT_PUBLIC_USE_MOCKS is not "false" these answer from the browser with sample data
// and follow the rules the backend would enforce, so the screens can be judged and the contracts changed cheaply.
export const isMock = config.useMocks;
const e = encodeURIComponent;

// ── users and roles ────────────────────────────────────────────────────────────────────────────
export type Role = "student" | "content_editor" | "admin";
export type UserRow = { id: string; email: string; full_name: string; role: Role; status: "active" | "disabled"; created_at: string; last_login_at: string | null };
export const ROLE_LABEL: Record<Role, string> = { student: "Student", content_editor: "Content editor", admin: "Administrator" };

export const usersApi = {
  list: (p: { q?: string; role?: string; cursor?: string } = {}): Promise<Page<UserRow>> => (isMock ? mock.users.list(p) : api.get<Page<UserRow>>("/admin/users", { query: { q: p.q, role: p.role, cursor: p.cursor, limit: 50 } })),
  setRole: (id: string, role: Role, reason: string): Promise<UserRow> => (isMock ? mock.users.setRole(id, role, reason) : api.post<UserRow>(`/admin/users/${e(id)}/role`, { role, reason })),
  setStatus: (id: string, status: "active" | "disabled", reason: string): Promise<UserRow> => (isMock ? mock.users.setStatus(id, status, reason) : api.post<UserRow>(`/admin/users/${e(id)}/status`, { status, reason })),
  inviteStaff: (b: { email: string; full_name: string; role: "content_editor" | "admin" }): Promise<UserRow> => (isMock ? mock.users.invite(b) : api.post<UserRow>("/admin/staff", b)),
};

// ── staff action log ───────────────────────────────────────────────────────────────────────────
export type LogEntry = { id: string; at: string; actor_email: string; action: string; entity_type: string; entity_id: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null };
export const logApi = {
  list: (p: { actor?: string; action?: string; entityType?: string; cursor?: string } = {}): Promise<Page<LogEntry>> =>
    isMock ? mock.log.list(p) : api.get<Page<LogEntry>>("/admin/action-log", { query: { actor_email: p.actor, action_prefix: p.action, entity_type: p.entityType, cursor: p.cursor, limit: 50 } }),
};

// ── announcements ──────────────────────────────────────────────────────────────────────────────
export type AnnouncementStatus = "draft" | "scheduled" | "sent" | "cancelled";
export type Announcement = {
  id: string;
  title: string;
  body: string;
  deep_link: string | null;
  /** exam_slug null means every student. */
  exam_slug: string | null;
  send_push: boolean;
  status: AnnouncementStatus;
  send_at: string | null;
  sent_at: string | null;
  recipients: number | null;
  read_count: number | null;
  created_at: string;
};
export type AnnouncementInput = { title: string; body: string; deep_link: string | null; exam_slug: string | null; send_push: boolean; send_at: string | null };
export const ANNOUNCEMENT_STATUS_LABEL: Record<AnnouncementStatus, string> = { draft: "Draft", scheduled: "Scheduled", sent: "Sent", cancelled: "Cancelled" };
export const announcementsApi = {
  list: (status?: string): Promise<Page<Announcement>> => (isMock ? mock.announcements.list(status) : api.get<Page<Announcement>>("/admin/announcements", { query: { status, limit: 50 } })),
  create: (b: AnnouncementInput): Promise<Announcement> => (isMock ? mock.announcements.create(b) : api.post<Announcement>("/admin/announcements", b)),
  update: (id: string, b: AnnouncementInput): Promise<Announcement> => (isMock ? mock.announcements.update(id, b) : api.patch<Announcement>(`/admin/announcements/${e(id)}`, b)),
  sendNow: (id: string): Promise<Announcement> => (isMock ? mock.announcements.sendNow(id) : api.post<Announcement>(`/admin/announcements/${e(id)}/send`)),
  cancel: (id: string): Promise<Announcement> => (isMock ? mock.announcements.cancel(id) : api.post<Announcement>(`/admin/announcements/${e(id)}/cancel`)),
};

// ── current affairs ────────────────────────────────────────────────────────────────────────────
export type CaStatus = "draft" | "in_review" | "published" | "retired";
export type Importance = "low" | "medium" | "high";
export type CaItem = {
  id: string;
  exam_slug: string;
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  published_on: string;
  importance: Importance;
  topic_ids: string[];
  status: CaStatus;
  created_by: string;
  updated_at: string;
};
export type CaInput = Omit<CaItem, "id" | "status" | "created_by" | "updated_at">;
export const CA_STATUS_LABEL: Record<CaStatus, string> = { draft: "Draft", in_review: "In review", published: "Published", retired: "Retired" };
export const IMPORTANCE_LABEL: Record<Importance, string> = { low: "Low", medium: "Medium", high: "High" };
/** Where each state may go. The same table is what the backend would enforce. */
export const CA_MOVES: Record<CaStatus, CaStatus[]> = { draft: ["in_review"], in_review: ["published", "draft"], published: ["retired"], retired: ["draft"] };
export const currentAffairsAdminApi = {
  list: (p: { exam?: string; status?: string } = {}): Promise<Page<CaItem>> => (isMock ? mock.ca.list(p) : api.get<Page<CaItem>>("/admin/current-affairs", { query: { exam_slug: p.exam, status: p.status, limit: 50 } })),
  create: (b: CaInput): Promise<CaItem> => (isMock ? mock.ca.create(b) : api.post<CaItem>("/admin/current-affairs", b)),
  update: (id: string, b: CaInput): Promise<CaItem> => (isMock ? mock.ca.update(id, b) : api.patch<CaItem>(`/admin/current-affairs/${e(id)}`, b)),
  setStatus: (id: string, status: CaStatus, note?: string): Promise<CaItem> => (isMock ? mock.ca.setStatus(id, status, note) : api.post<CaItem>(`/admin/current-affairs/${e(id)}/status`, { status, note: note ?? null })),
};

// ── daily quiz schedule ────────────────────────────────────────────────────────────────────────
export type QuizDay = { date: string; test_id: string; test_title: string };
export const dailyQuizAdminApi = {
  list: (exam: string, from: string, to: string): Promise<QuizDay[]> => (isMock ? mock.quiz.list(exam, from, to) : api.get<QuizDay[]>(`/admin/exams/${e(exam)}/daily-quizzes`, { query: { from, to } })),
  set: (exam: string, date: string, test: { id: string; title: string }): Promise<QuizDay> => (isMock ? mock.quiz.set(exam, date, test) : api.put<QuizDay>(`/admin/exams/${e(exam)}/daily-quizzes/${e(date)}`, { test_id: test.id })),
  clear: (exam: string, date: string): Promise<void> => (isMock ? mock.quiz.clear(exam, date) : api.delete<void>(`/admin/exams/${e(exam)}/daily-quizzes/${e(date)}`)),
};
