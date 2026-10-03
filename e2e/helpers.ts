import { execSync } from "node:child_process";
import type { BrowserContext, Page } from "@playwright/test";

export const API = process.env.E2E_API_URL ?? "http://localhost:8020/api/v1";
// Local stack only: the dev email provider prints activation links to the worker log, and staff accounts are
// created with the operator command inside the API container.
const WORKER = process.env.E2E_WORKER_CONTAINER ?? "shikshag-worker-1";
const API_CONTAINER = process.env.E2E_API_CONTAINER ?? "shikshag-api-1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const password = () => `E2e-${uniq()}-Zq9!x`;

export type Account = { email: string; password: string; role: "admin" | "content_editor" | "student"; access: string; refresh: string; user: unknown };

async function json(path: string, init: RequestInit) {
  let res = await fetch(`${API}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  // The backend rate-limits sign-ups; wait out the Retry-After and try again.
  for (let i = 0; i < 5 && res.status === 429; i++) {
    await sleep((Number(res.headers.get("retry-after")) || 5) * 1000 + 500);
    res = await fetch(`${API}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
}

/** The set-password link emailed to the person greeted by `firstName` (the dev log shows the first name, not the address). */
async function activationToken(firstName: string, since: Date): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const log = execSync(`docker logs ${WORKER} --since ${since.toISOString()} 2>&1`, { encoding: "utf8" });
    const line = log.split(/\r?\n/).find((l) => l.toLowerCase().includes(`hi ${firstName.toLowerCase()},`));
    const m = line?.match(/set-password\?token=([A-Za-z0-9_-]+)/);
    if (m) return m[1];
    await sleep(1000);
  }
  throw new Error(`No activation link in ${WORKER} log for ${firstName}`);
}

async function activate(firstName: string, since: Date, email: string, role: Account["role"]): Promise<Account> {
  const pw = password();
  const token = await activationToken(firstName, since);
  const tokens = await json("/auth/set-password", { method: "POST", body: JSON.stringify({ token, password: pw }) });
  return { email, password: pw, role, access: tokens.access_token, refresh: tokens.refresh_token, user: tokens.user };
}

/** A staff account made the way an operator makes one. */
export async function createStaff(role: "admin" | "content_editor"): Promise<Account> {
  const first = `S${uniq()}`;
  const email = `staff-${first.toLowerCase()}@example.com`;
  const since = new Date(Date.now() - 2000);
  execSync(`docker exec ${API_CONTAINER} python -m app.cli create-admin --email ${email} --full-name "${first} Staff" --role ${role}`, { stdio: "pipe" });
  return activate(first, since, email, role);
}

/** An ordinary student account. Sign-ups are rate limited, so tests share one. */
let student: Promise<Account> | null = null;
export const sharedStudent = () =>
  (student ??= (async () => {
    const first = `T${uniq()}`;
    const email = `student-${first.toLowerCase()}@example.com`;
    const since = new Date(Date.now() - 2000);
    await json("/auth/register", { method: "POST", body: JSON.stringify({ full_name: `${first} Student`, email, accept_terms: true }) });
    return activate(first, since, email, "student");
  })());

/** A fresh login for an existing account: its own tokens, so signing out in one test never affects another. */
export async function newSession(a: Account): Promise<Account> {
  const t = await json("/auth/login", { method: "POST", body: JSON.stringify({ email: a.email, password: a.password }) });
  return { ...a, access: t.access_token, refresh: t.refresh_token, user: t.user };
}

/** Signs the browser in by seeding the storage the console writes after a login. */
export async function signIn(context: BrowserContext, a: Account) {
  await context.addInitScript(
    ([access, refresh, user]) => {
      localStorage.setItem("sga_token", access as string);
      localStorage.setItem("sga_refresh_token", refresh as string);
      localStorage.setItem("sga_user", JSON.stringify(user));
    },
    [a.access, a.refresh, a.user]
  );
}

export async function studentEvents(s: Account, examSlug: string): Promise<{ title: string; starts_on: string; certainty: string; source_url: string }[]> {
  const body = await json(`/exams/${examSlug}/events`, { method: "GET", headers: { authorization: `Bearer ${s.access}` } });
  return body.events;
}

export const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
