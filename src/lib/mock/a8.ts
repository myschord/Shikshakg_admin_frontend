import { ApiError, type Page } from "@/lib/api/client";
import type { Announcement, AnnouncementInput, CaInput, CaItem, CaStatus, LogEntry, QuizDay, Role, UserRow } from "@/lib/api/a8";
import { CA_MOVES } from "@/lib/api/a8";

/**
 * In-browser stand-in for backend routes that do not exist yet (see docs/BACKEND_NEEDS.md). It is one small
 * database kept in localStorage, so a change made on one screen shows up on the others (a role change appears in
 * the action log). It enforces the rules the backend would, and answers with the same error shape.
 */
type Db = { users: UserRow[]; log: LogEntry[]; announcements: Announcement[]; ca: CaItem[]; quiz: Record<string, QuizDay[]>; seq: number };

const KEY = "sga_mock_a8_v1";
const DAY = 86_400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const istDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const dayOffset = (n: number) => istDay.format(new Date(Date.now() + n * DAY));

const fail = (status: number, code: string, message: string, details?: unknown): never => {
  throw new ApiError({ status, code, message, details, requestId: "mock" });
};

function me(): { email: string; name: string; role: Role } {
  try {
    const u = JSON.parse(localStorage.getItem("sga_user") ?? "null") as { email?: string; full_name?: string; role?: Role } | null;
    if (u?.email) return { email: u.email, name: u.full_name ?? u.email, role: u.role ?? "admin" };
  } catch {
    // fall through
  }
  return { email: "staff@example.com", name: "Staff", role: "admin" };
}

function seed(): Db {
  const u = (n: number, email: string, name: string, role: Role, days: number, login: number | null, status: "active" | "disabled" = "active"): UserRow => ({ id: `mock-user-${n}`, email, full_name: name, role, status, created_at: ago(days), last_login_at: login === null ? null : ago(login) });
  const users = [
    u(1, "meera.admin@example.com", "Meera Admin", "admin", 200, 0),
    u(2, "rohan.editor@example.com", "Rohan Editor", "content_editor", 150, 1),
    u(3, "sana.editor@example.com", "Sana Editor", "content_editor", 90, 3),
    u(4, "aarav.k@example.com", "Aarav Kumar", "student", 60, 0),
    u(5, "diya.s@example.com", "Diya Sharma", "student", 45, 2),
    u(6, "kabir.m@example.com", "Kabir Mehta", "student", 30, 9),
    u(7, "ira.p@example.com", "Ira Patel", "student", 21, null),
    u(8, "vihaan.r@example.com", "Vihaan Rao", "student", 14, 5),
    u(9, "anaya.g@example.com", "Anaya Gupta", "student", 7, 1),
    u(10, "old.account@example.com", "Old Account", "student", 400, 380, "disabled"),
  ];
  const mk = (n: number, d: number, h: number, actor: string, action: string, type: string, id: string, before: LogEntry["before"], after: LogEntry["after"]): LogEntry => ({ id: `mock-log-${n}`, at: ago(d, h), actor_email: actor, action, entity_type: type, entity_id: id, before, after });
  const log = [
    mk(1, 0, 2, "rohan.editor@example.com", "courses.lecture_updated", "lecture", "0192a1", { status: "draft" }, { status: "published" }),
    mk(2, 0, 5, "meera.admin@example.com", "ai_policy.publish", "ai_policy", "0192b2", { free_monthly_units: 3 }, { free_monthly_units: 5 }),
    mk(3, 1, 1, "sana.editor@example.com", "exam_events.published", "exam_event", "0192c3", { status: "draft" }, { status: "published" }),
    mk(4, 1, 6, "meera.admin@example.com", "commerce.product_updated", "product", "0192d4", { status: "draft" }, { status: "active" }),
    mk(5, 2, 3, "rohan.editor@example.com", "questions.status_changed", "question", "0192e5", { status: "in_review" }, { status: "published" }),
    mk(6, 2, 8, "meera.admin@example.com", "commerce.entitlement_granted", "entitlement", "0192f6", null, { reason: "support case", validity_days: 30 }),
    mk(7, 3, 2, "sana.editor@example.com", "courses.section_added", "course", "019301", null, { section: "0193a1" }),
    mk(8, 4, 4, "rohan.editor@example.com", "tests.published", "test", "019312", { status: "draft" }, { status: "published" }),
    mk(9, 5, 1, "meera.admin@example.com", "commerce.refund_rejected", "refund", "019323", { status: "requested" }, { status: "rejected", note: "outside refund window" }),
    mk(10, 6, 7, "sana.editor@example.com", "questions.updated", "question", "019334", { difficulty: "easy" }, { difficulty: "medium" }),
    mk(11, 8, 2, "meera.admin@example.com", "ai_policy.publish", "ai_policy", "019345", { auto_publish: true }, { auto_publish: false }),
    mk(12, 12, 3, "rohan.editor@example.com", "papers.published", "paper", "019356", { status: "draft" }, { status: "published" }),
  ];
  const announcements: Announcement[] = [
    { id: "mock-ann-1", title: "New mock tests this week", body: "Three full-length BPSC prelims mock tests are live. Try one this weekend.", deep_link: "/exams/bpsc/tests", exam_slug: "bpsc", send_push: true, status: "sent", send_at: null, sent_at: ago(6), recipients: 1240, read_count: 612, created_at: ago(6, 3) },
    { id: "mock-ann-2", title: "Maintenance on Sunday", body: "Practice and tests will be unavailable for 30 minutes on Sunday at 2 am.", deep_link: null, exam_slug: null, send_push: false, status: "scheduled", send_at: ahead(2), sent_at: null, recipients: null, read_count: null, created_at: ago(1) },
    { id: "mock-ann-3", title: "Draft: new course", body: "A new polity course is coming.", deep_link: null, exam_slug: "upsc-cse", send_push: false, status: "draft", send_at: null, sent_at: null, recipients: null, read_count: null, created_at: ago(0, 4) },
  ];
  const c = (n: number, exam: string, title: string, summary: string, src: string, url: string, days: number, imp: CaItem["importance"], status: CaStatus): CaItem => ({ id: `mock-ca-${n}`, exam_slug: exam, title, summary, source_name: src, source_url: url, published_on: dayOffset(-days), importance: imp, topic_ids: [], status, created_by: "rohan.editor@example.com", updated_at: ago(days) });
  const ca = [
    c(1, "bpsc", "Bihar launches new skill mission for youth", "The state announced a skill mission targeting 5 lakh youth over three years, with training partners in every district.", "PIB", "https://pib.gov.in/", 1, "high", "published"),
    c(2, "bpsc", "Kosi flood preparedness plan reviewed", "The water resources department reviewed embankment work ahead of the monsoon peak.", "The Hindu", "https://www.thehindu.com/", 2, "medium", "in_review"),
    c(3, "upsc-cse", "Cabinet approves revised semiconductor incentive", "The scheme extends fiscal support for fabrication units and raises the per-unit cap.", "PIB", "https://pib.gov.in/", 3, "high", "published"),
    c(4, "bpsc", "New railway line sanctioned for north Bihar", "A new line connecting two district headquarters received sanction.", "Indian Express", "https://indianexpress.com/", 5, "low", "draft"),
  ];
  const quiz: Record<string, QuizDay[]> = {};
  return { users, log, announcements, ca, quiz, seq: 100 };
}

let memory: Db | null = null;
function load(): Db {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as Db;
  } catch {
    memory = null;
  }
  memory ??= seed();
  // The person using the console is always in the list, so "you cannot change your own role" can be seen.
  const who = me();
  if (!memory.users.some((x) => x.email === who.email)) memory.users.unshift({ id: "mock-user-me", email: who.email, full_name: who.name, role: who.role, status: "active", created_at: ago(30), last_login_at: new Date().toISOString() });
  return memory;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // private mode: the data lives for this page only
  }
}
const nextId = (p: string) => `${p}-${++load().seq}`;
const record = (action: string, entity_type: string, entity_id: string, before: LogEntry["before"], after: LogEntry["after"]) => {
  const db = load();
  db.log.unshift({ id: nextId("mock-log"), at: new Date().toISOString(), actor_email: me().email, action, entity_type, entity_id, before, after });
};
const done = async <T>(v: T): Promise<T> => {
  save();
  await new Promise((r) => setTimeout(r, 120));
  return structuredClone(v);
};
const page = <T>(items: T[]): Page<T> => ({ items, next_cursor: null, has_more: false });

export const mock = {
  /** Test helper: forget everything and start from the sample data. */
  reset() {
    memory = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },

  users: {
    async list(p: { q?: string; role?: string }) {
      const q = (p.q ?? "").trim().toLowerCase();
      return done(page(load().users.filter((u) => (!p.role || u.role === p.role) && (!q || u.email.includes(q) || u.full_name.toLowerCase().includes(q)))));
    },
    async setRole(id: string, role: Role, reason: string) {
      const db = load();
      const u = db.users.find((x) => x.id === id) ?? fail(404, "user_not_found", "User not found.");
      if (!reason.trim()) fail(422, "reason_required", "Say why the role is changing.");
      if (u.email === me().email) fail(409, "cannot_change_own_role", "You cannot change your own role. Ask another administrator.");
      if (u.role === role) fail(409, "role_unchanged", "That is already their role.");
      if (u.role === "admin" && db.users.filter((x) => x.role === "admin" && x.status === "active").length <= 1) fail(409, "last_admin", "This is the last active administrator.");
      const before = { role: u.role };
      u.role = role;
      record("users.role_changed", "user", u.id, before, { role, reason, email: u.email });
      return done(u);
    },
    async setStatus(id: string, status: "active" | "disabled", reason: string) {
      const db = load();
      const u = db.users.find((x) => x.id === id) ?? fail(404, "user_not_found", "User not found.");
      if (!reason.trim()) fail(422, "reason_required", "Say why.");
      if (u.email === me().email) fail(409, "cannot_disable_self", "You cannot disable your own account.");
      if (u.status === status) fail(409, "status_unchanged", "Already in that state.");
      if (status === "disabled" && u.role === "admin" && db.users.filter((x) => x.role === "admin" && x.status === "active").length <= 1) fail(409, "last_admin", "This is the last active administrator.");
      const before = { status: u.status };
      u.status = status;
      record(status === "disabled" ? "users.disabled" : "users.enabled", "user", u.id, before, { status, reason, email: u.email });
      return done(u);
    },
    async invite(b: { email: string; full_name: string; role: "content_editor" | "admin" }) {
      const db = load();
      const email = b.email.trim().toLowerCase();
      if (db.users.some((x) => x.email === email)) fail(409, "email_taken", "An account with this email already exists.");
      const row: UserRow = { id: nextId("mock-user"), email, full_name: b.full_name.trim(), role: b.role, status: "active", created_at: new Date().toISOString(), last_login_at: null };
      db.users.unshift(row);
      record("users.staff_invited", "user", row.id, null, { email, role: b.role });
      return done(row);
    },
  },

  log: {
    async list(p: { actor?: string; action?: string; entityType?: string }) {
      const a = (p.actor ?? "").trim().toLowerCase();
      const act = (p.action ?? "").trim().toLowerCase();
      return done(page(load().log.filter((l) => (!a || l.actor_email.toLowerCase().includes(a)) && (!act || l.action.toLowerCase().startsWith(act)) && (!p.entityType || l.entity_type === p.entityType))));
    },
  },

  announcements: {
    async list(status?: string) {
      return done(page(load().announcements.filter((a) => !status || a.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at))));
    },
    async create(b: AnnouncementInput) {
      const db = load();
      validateAnnouncement(b);
      const row: Announcement = { id: nextId("mock-ann"), ...b, status: b.send_at ? "scheduled" : "draft", sent_at: null, recipients: null, read_count: null, created_at: new Date().toISOString() };
      db.announcements.unshift(row);
      record("announcements.created", "announcement", row.id, null, { title: b.title, status: row.status });
      return done(row);
    },
    async update(id: string, b: AnnouncementInput) {
      const row = load().announcements.find((x) => x.id === id) ?? fail(404, "announcement_not_found", "Announcement not found.");
      if (row.status === "sent" || row.status === "cancelled") fail(409, "announcement_locked", "A sent or cancelled announcement cannot be changed.");
      validateAnnouncement(b);
      Object.assign(row, b, { status: b.send_at ? "scheduled" : "draft" });
      record("announcements.updated", "announcement", row.id, null, { title: b.title });
      return done(row);
    },
    async sendNow(id: string) {
      const db = load();
      const row = db.announcements.find((x) => x.id === id) ?? fail(404, "announcement_not_found", "Announcement not found.");
      if (row.status === "sent" || row.status === "cancelled") fail(409, "announcement_locked", "This announcement was already sent or cancelled.");
      const audience = row.exam_slug ? 420 : 1240;
      Object.assign(row, { status: "sent", sent_at: new Date().toISOString(), send_at: null, recipients: audience, read_count: 0 });
      record("announcements.sent", "announcement", row.id, { status: "draft" }, { status: "sent", recipients: audience });
      return done(row);
    },
    async cancel(id: string) {
      const row = load().announcements.find((x) => x.id === id) ?? fail(404, "announcement_not_found", "Announcement not found.");
      if (row.status === "sent") fail(409, "announcement_sent", "It has already been sent and cannot be cancelled.");
      if (row.status === "cancelled") fail(409, "announcement_locked", "Already cancelled.");
      const before = { status: row.status };
      row.status = "cancelled";
      record("announcements.cancelled", "announcement", row.id, before, { status: "cancelled" });
      return done(row);
    },
  },

  ca: {
    async list(p: { exam?: string; status?: string }) {
      return done(page(load().ca.filter((c) => (!p.exam || c.exam_slug === p.exam) && (!p.status || c.status === p.status)).sort((a, b) => b.published_on.localeCompare(a.published_on) || b.updated_at.localeCompare(a.updated_at))));
    },
    async create(b: CaInput) {
      const db = load();
      validateCa(b);
      const row: CaItem = { id: nextId("mock-ca"), ...b, status: "draft", created_by: me().email, updated_at: new Date().toISOString() };
      db.ca.unshift(row);
      record("current_affairs.created", "current_affairs", row.id, null, { title: b.title });
      return done(row);
    },
    async update(id: string, b: CaInput) {
      const row = load().ca.find((x) => x.id === id) ?? fail(404, "item_not_found", "Item not found.");
      if (row.status === "published" || row.status === "retired") fail(409, "item_locked", "A published item cannot be edited. Retire it and move it back to draft first.");
      validateCa(b);
      Object.assign(row, b, { updated_at: new Date().toISOString() });
      record("current_affairs.updated", "current_affairs", row.id, null, { title: b.title });
      return done(row);
    },
    async setStatus(id: string, status: CaStatus, note?: string) {
      const row = load().ca.find((x) => x.id === id) ?? fail(404, "item_not_found", "Item not found.");
      if (!CA_MOVES[row.status].includes(status)) fail(409, "invalid_transition", `An item that is ${row.status.replace("_", " ")} cannot move to ${status.replace("_", " ")}.`);
      if (status === "published" && me().role !== "admin") fail(403, "forbidden", "Only an administrator can publish.");
      const before = { status: row.status };
      row.status = status;
      row.updated_at = new Date().toISOString();
      record(`current_affairs.${status}`, "current_affairs", row.id, before, { status, note: note ?? null });
      return done(row);
    },
  },

  quiz: {
    async list(exam: string, from: string, to: string) {
      return done((load().quiz[exam] ?? []).filter((d) => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date)));
    },
    async set(exam: string, date: string, test: { id: string; title: string }) {
      const db = load();
      const today = istDay.format(new Date());
      if (date < today) fail(409, "date_in_past", "A quiz cannot be set for a day that has passed.");
      const list = (db.quiz[exam] ??= []);
      const used = list.find((d) => d.test_id === test.id && d.date !== date);
      if (used) fail(409, "test_already_scheduled", `This test is already the quiz for ${used.date}. Students would see the same questions twice.`);
      const row: QuizDay = { date, test_id: test.id, test_title: test.title };
      const i = list.findIndex((d) => d.date === date);
      const before = i >= 0 ? { test: list[i].test_title } : null;
      if (i >= 0) list[i] = row;
      else list.push(row);
      record("daily_quiz.scheduled", "daily_quiz", `${exam}:${date}`, before, { test: test.title });
      return done(row);
    },
    async clear(exam: string, date: string) {
      const db = load();
      const list = db.quiz[exam] ?? [];
      const row = list.find((d) => d.date === date) ?? fail(404, "not_scheduled", "No quiz is set for that day.");
      if (date <= istDay.format(new Date())) fail(409, "date_locked", "Today's quiz and earlier days cannot be removed.");
      db.quiz[exam] = list.filter((d) => d.date !== date);
      record("daily_quiz.cleared", "daily_quiz", `${exam}:${date}`, { test: row.test_title }, null);
      return done(undefined);
    },
  },
};

function validateAnnouncement(b: AnnouncementInput) {
  if (!b.title.trim() || b.title.length > 120) fail(422, "invalid_title", "The title must be 1 to 120 characters.");
  if (!b.body.trim() || b.body.length > 1000) fail(422, "invalid_body", "The message must be 1 to 1000 characters.");
  if (b.deep_link && !/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(b.deep_link)) fail(422, "invalid_link", "The link must be a path starting with / or an https address.");
  if (b.send_at && new Date(b.send_at).getTime() < Date.now() + 60_000) fail(422, "send_at_in_past", "Choose a time at least a minute from now.");
}

function validateCa(b: CaInput) {
  if (!b.title.trim() || b.title.length > 200) fail(422, "invalid_title", "The headline must be 1 to 200 characters.");
  if (!b.summary.trim() || b.summary.length > 600) fail(422, "invalid_summary", "The summary must be 1 to 600 characters.");
  if (!/^https:\/\//.test(b.source_url)) fail(422, "invalid_source_url", "The source link must start with https://.");
}
