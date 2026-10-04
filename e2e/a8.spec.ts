import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, createStaff, firstTopic, horizontalOverflow, newSession, signIn, type Account } from "./helpers";

// These screens run on sample data kept in the browser (the backend has no routes for them yet), so every test
// starts from a fresh browser context and the same seed. The daily quiz picker also lists real published tests.
const EXAM = "bpsc";
let admin: Account;
let editor: Account;
const cache = new Map<string, { at: number; session: Account }>();
async function session(a: Account): Promise<Account> {
  const hit = cache.get(a.email);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.session;
  const fresh = await newSession(a);
  cache.set(a.email, { at: Date.now(), session: fresh });
  return fresh;
}

test.beforeAll(async () => {
  admin = await createStaff("admin");
  editor = await createStaff("content_editor");
});

const row = (page: Page, text: string | RegExp) => page.locator("tr", { hasText: text });

test.describe("A8: users and roles, and the action log (sample data)", () => {
  test("search, change a role, switch off an account, add staff; each change is logged", async ({ page, context }) => {
    await signIn(context, await session(admin));
    await page.goto("/users");
    await expect(page.getByRole("note")).toContainText("Sample data");
    await expect(row(page, admin.email)).toContainText("You");
    await expect(row(page, admin.email).getByRole("button")).toHaveCount(0);

    await page.getByLabel("Name or email").fill("diya");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await row(page, "Diya Sharma").getByRole("button", { name: /^Change role/ }).click();
    const d = page.getByRole("alertdialog");
    await d.getByLabel("New role").selectOption("content_editor");
    await d.getByRole("button", { name: "Change role" }).click();
    await expect(d.getByText("Say why. It is kept in the action log.")).toBeVisible();
    await d.getByLabel(/^Reason/).fill("joins the content team");
    await d.getByRole("button", { name: "Change role" }).click();
    await expect(row(page, "Diya Sharma")).toContainText("Content editor");

    await page.getByLabel("Name or email").fill("kabir");
    await page.getByRole("button", { name: "Search" }).click();
    await row(page, "Kabir Mehta").getByRole("button", { name: /^Switch off/ }).click();
    await page.getByRole("alertdialog").getByLabel(/^Reason/).fill("asked to close the account");
    await page.getByRole("alertdialog").getByRole("button", { name: "Switch off" }).click();
    await expect(row(page, "Kabir Mehta")).toContainText("Switched off");

    await page.getByLabel("Name or email").fill("");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("button", { name: "Add staff" }).click();
    const inv = page.getByRole("dialog");
    await inv.getByRole("button", { name: "Create account" }).click();
    await expect(inv.getByText("Enter their name.")).toBeVisible();
    await expect(inv.getByText("Enter a valid email address.")).toBeVisible();
    await inv.getByLabel(/^Full name/).fill("Tara Newhire");
    await inv.getByLabel(/^Email/).fill("rohan.editor@example.com");
    await inv.getByRole("button", { name: "Create account" }).click();
    await expect(inv.getByText(/already exists/)).toBeVisible();
    await inv.getByLabel(/^Email/).fill("tara.new@example.com");
    await inv.getByRole("button", { name: "Create account" }).click();
    await expect(row(page, "Tara Newhire")).toContainText("Content editor");

    // The log, on another screen, shows all three, with before and after.
    await page.goto("/action-log");
    await expect(row(page, "Users: role changed")).toBeVisible();
    await expect(row(page, "Users: disabled")).toBeVisible();
    await expect(row(page, "Users: staff invited")).toBeVisible();
    await row(page, "Users: role changed").getByRole("button", { name: /^Open/ }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByRole("region", { name: "Before" })).toContainText("student");
    await expect(dlg.getByRole("region", { name: "After" })).toContainText("content_editor");
    await expect(dlg.getByRole("region", { name: "After" })).toContainText("joins the content team");
    await dlg.getByRole("button", { name: "Close", exact: true }).last().click();
  });

  test("the log filters by person and by what it starts with", async ({ page, context }) => {
    await signIn(context, await session(admin));
    await page.goto("/action-log");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const all = await page.locator("tbody tr").count();
    expect(all).toBeGreaterThan(5);
    await page.getByLabel("Who (email)").fill("sana");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.locator("tbody tr").first()).toContainText("sana.editor@example.com");
    await expect.poll(() => page.locator("tbody tr").count()).toBeLessThan(all);
    await page.getByLabel("Who (email)").fill("");
    await page.getByLabel("What starts with").fill("commerce");
    await page.getByRole("button", { name: "Filter" }).click();
    for (const t of await page.locator("tbody tr").allInnerTexts()) expect(t.toLowerCase()).toContain("commerce");
    await page.getByLabel("What starts with").fill("nothing-like-this");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("Nothing matches")).toBeVisible();
  });

  test("an editor cannot open the admin-only pages but can open the content ones", async ({ page, context }) => {
    await signIn(context, await session(editor));
    for (const path of ["/users", "/action-log", "/announcements"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: /role cannot open this page/i })).toBeVisible();
    }
    for (const [path, title] of [["/current-affairs", "Current affairs"], ["/daily-quiz", "Daily quiz"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    }
  });
});

test.describe("A8: announcements (sample data)", () => {
  test("write, check, schedule, send and cancel", async ({ page, context }) => {
    await signIn(context, await session(admin));
    await page.goto("/announcements");
    await expect(row(page, "New mock tests this week")).toContainText("Sent");
    await expect(row(page, "New mock tests this week").getByRole("button")).toHaveCount(0);

    await page.getByRole("button", { name: "New announcement" }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Save draft" }).click();
    await expect(d.getByText("Enter a title.")).toBeVisible();
    await expect(d.getByText("Write the message.")).toBeVisible();
    await d.getByLabel(/^Title/).fill("E2E new batch");
    await d.getByLabel(/^Message/).fill("A new batch starts on Monday.");
    await d.getByLabel(/^Where tapping it goes/).fill("not a link");
    await d.getByLabel(/^Send at/).fill("2020-01-01T10:00");
    await d.getByRole("button", { name: "Schedule" }).click();
    await expect(d.getByText(/Use a path that starts with \//)).toBeVisible();
    await expect(d.getByText("Choose a time at least a minute from now.")).toBeVisible();
    await d.getByLabel(/^Where tapping it goes/).fill("/exams/bpsc/tests");
    await d.getByLabel(/^Send at/).fill("");
    await d.getByLabel("Send to").selectOption(EXAM);
    await d.getByRole("checkbox", { name: /push notification/ }).check();
    await d.getByRole("button", { name: "Save draft" }).click();
    await expect(row(page, "E2E new batch")).toContainText("Draft");
    await expect(row(page, "E2E new batch")).toContainText("Push too");
    await expect(row(page, "E2E new batch")).toContainText(`Students of ${EXAM}`);

    await row(page, "E2E new batch").getByRole("button", { name: /^Send now/ }).click();
    await expect(page.getByRole("alertdialog")).toContainText("cannot be taken back");
    await page.getByRole("alertdialog").getByRole("button", { name: "Send now" }).click();
    await expect(row(page, "E2E new batch")).toContainText("Sent");
    await expect(row(page, "E2E new batch")).toContainText("420");
    await expect(row(page, "E2E new batch").getByRole("button")).toHaveCount(0);

    await row(page, "Maintenance on Sunday").getByRole("button", { name: /^Cancel/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel announcement" }).click();
    await expect(row(page, "Maintenance on Sunday")).toContainText("Cancelled");

    await page.goto("/action-log");
    await expect(row(page, "Announcements: sent")).toBeVisible();
    await expect(row(page, "Announcements: cancelled")).toBeVisible();
  });
});

test.describe("A8: current affairs (sample data)", () => {
  test("write, send for review, publish and retire; an editor cannot publish", async ({ page, context, browser }) => {
    await signIn(context, await session(admin));
    await page.goto("/current-affairs");
    await page.getByRole("button", { name: "New item" }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Save draft" }).click();
    await expect(d.getByText("Write the headline.")).toBeVisible();
    await expect(d.getByText("Write a short summary.")).toBeVisible();
    await expect(d.getByText("Name the source, for example PIB.")).toBeVisible();
    await expect(d.getByText("Enter the source link, starting with https://.")).toBeVisible();
    await d.getByLabel("Exam").selectOption(EXAM);
    await d.getByLabel(/^Headline/).fill("E2E state announces new scheme");
    await d.getByLabel(/^Summary/).fill("The state announced a scheme for aspirants.");
    await d.getByLabel(/^Source name/).fill("PIB");
    await d.getByLabel(/^Source link/).fill("http://insecure.example");
    await d.getByRole("button", { name: "Save draft" }).click();
    await expect(d.getByText("Enter the source link, starting with https://.")).toBeVisible();
    await d.getByLabel(/^Source link/).fill("https://pib.gov.in/x");
    await d.getByRole("button", { name: "Save draft" }).click();
    const r = row(page, "E2E state announces new scheme");
    await expect(r).toContainText("Draft");
    await expect(r.getByRole("button", { name: /^Publish/ })).toHaveCount(0); // a draft goes to review first

    await r.getByRole("button", { name: /^Send for review/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Send for review" }).click();
    await expect(r).toContainText("In review");
    await expect(r.getByRole("button", { name: /^Edit/ })).toBeVisible();
    await r.getByRole("button", { name: /^Publish/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
    await expect(r).toContainText("Published");
    await expect(r.getByRole("button", { name: /^Edit/ })).toHaveCount(0); // live items are not edited in place
    await r.getByRole("button", { name: /^Retire/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Retire" }).click();
    await expect(r).toContainText("Retired");

    // An editor sees "Send for review" on the same kind of item, but no Publish button.
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await signIn(ctx2, await session(editor));
    await p2.goto("/current-affairs");
    const seeded = row(p2, "Kosi flood preparedness plan reviewed");
    await expect(seeded).toContainText("In review");
    await expect(seeded.getByRole("button", { name: /^Publish/ })).toHaveCount(0);
    await expect(seeded.getByRole("button", { name: /^Back to draft/ })).toBeVisible();
    await ctx2.close();
  });
});

// A published test the picker can offer, made through the real API and cleaned up afterwards.
const made: { questions: string[]; tests: string[]; papers: string[] } = { questions: [], tests: [], papers: [] };
async function publishedTest(tag: string): Promise<{ id: string; title: string }> {
  const s = await session(editor);
  const code = `E2E_Q_${tag.toUpperCase()}`;
  await apiAs(s, "POST", "/admin/papers", { exam_slug: EXAM, stage_slug: "prelims", paper_code: code, title: `E2E quiz paper ${tag}`, year: 2022, marking: { correct: 1, negative: 0 }, is_free_preview: true, is_partial: false });
  made.papers.push(code);
  const t = await firstTopic(EXAM, "prelims");
  const records = [1, 2].map((i) => ({
    question_id: `e2e-${tag}-${i}`,
    content: { question: `[E2E] ${tag} quiz question ${i}: which is right?`, options: { A: "No", B: "Yes", C: "Maybe", D: "Never" }, answer: "B", explanation: "B." },
    metadata: { source_type: "PYQ", exam_id: EXAM, exam_stage: "prelims", paper_id: code, year: 2022, question_number: i, subject_id: t.subject, topic_id: t.topic, language: "en", difficulty: "easy", question_type: "direct_fact" },
  }));
  const res = await fetch(`http://localhost:8020/api/v1/admin/question-imports?filename=e2e-${tag}.json&publish=true`, { method: "POST", headers: { authorization: `Bearer ${s.access}`, "content-type": "application/json" }, body: JSON.stringify(records) });
  const job = await res.json();
  for (let i = 0; i < 40; i++) {
    if ((await apiAs(s, "GET", `/admin/question-imports/${job.id}`)).status === "completed") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const q = await apiAs(s, "GET", `/admin/questions?exam=${EXAM}&status=published&limit=100`);
  made.questions.push(...q.items.filter((i: { preview: string }) => i.preview.includes(`[E2E] ${tag}`)).map((i: { id: string }) => i.id));
  await apiAs(s, "POST", `/admin/papers/${code}/publish`);
  const test = await apiAs(s, "POST", "/admin/tests/from-paper", { paper_code: code, title: `E2E quiz test ${tag}`, is_free_preview: true, publish: true, position: 1 });
  made.tests.push(test.id);
  return { id: test.id, title: test.title };
}

test.afterAll(async () => {
  const s = await session(editor);
  for (const id of made.tests) await apiAs(s, "POST", `/admin/tests/${id}/archive`).catch(() => {});
  for (const code of made.papers) await apiAs(s, "POST", `/admin/papers/${code}/unpublish`).catch(() => {});
  for (const id of made.questions) await apiAs(s, "POST", `/admin/questions/${id}/status`, { status: "retired", note: "e2e cleanup" }).catch(() => {});
});

test.describe("A8: daily quiz (sample schedule, real tests)", () => {
  test("choose a published test for a day, change it, and the rules are explained", async ({ page, context }) => {
    test.setTimeout(180_000);
    const tag = Date.now().toString(36);
    const test1 = await publishedTest(`${tag}a`);
    const test2 = await publishedTest(`${tag}b`);
    await signIn(context, await session(editor));
    await page.goto("/daily-quiz");
    await page.getByLabel("Exam").selectOption(EXAM);
    await expect(page.getByRole("note").filter({ hasText: /No quiz is set for/ })).toBeVisible();

    const today = page.locator("tr", { hasText: "Today" });
    await expect(today.getByRole("button", { name: /^Remove/ })).toHaveCount(0); // today's quiz cannot be taken away
    await today.getByRole("button", { name: /^Choose a test/ }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Find a test").fill(test1.title);
    await d.getByRole("radio").first().check();
    await d.getByRole("button", { name: "Set as the quiz" }).click();
    await expect(today).toContainText(test1.title);

    // The next day: the same test is refused, another is accepted.
    const rows = page.locator("tbody tr");
    const tomorrow = rows.nth((await rows.evaluateAll((els) => els.findIndex((e) => e.textContent?.includes("Today")))) + 1);
    await tomorrow.getByRole("button", { name: /^Choose a test/ }).click();
    await page.getByRole("dialog").getByLabel("Find a test").fill(test1.title);
    await page.getByRole("dialog").getByRole("radio").first().check();
    await page.getByRole("dialog").getByRole("button", { name: "Set as the quiz" }).click();
    await expect(page.getByRole("dialog")).toContainText(/already the quiz for/);
    await page.getByRole("dialog").getByLabel("Find a test").fill(test2.title);
    await page.getByRole("dialog").getByRole("radio").first().check();
    await page.getByRole("dialog").getByRole("button", { name: "Set as the quiz" }).click();
    await expect(tomorrow).toContainText(test2.title);
    await tomorrow.getByRole("button", { name: /^Remove/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(tomorrow).toContainText("Not set");

    // Days that have passed cannot be changed.
    const past = rows.first();
    await expect(past.getByRole("button")).toHaveCount(0);
  });
});

test.describe("A8 screens at tablet and desktop width", () => {
  for (const [name, path] of [["users", "/users"], ["action log", "/action-log"], ["announcements", "/announcements"], ["current affairs", "/current-affairs"], ["daily quiz", "/daily-quiz"]])
    for (const width of [768, 1280])
      test(`${name} @${width}`, async ({ page, context }) => {
        const csp: string[] = [];
        page.on("console", (m) => /violates the following|Content Security Policy/i.test(m.text()) && csp.push(m.text().slice(0, 160)));
        await signIn(context, await session(admin));
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(900);
        expect(await horizontalOverflow(page), "page scrolls sideways").toBeLessThanOrEqual(0);
        expect(csp).toEqual([]);
        const bad = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      });
});
