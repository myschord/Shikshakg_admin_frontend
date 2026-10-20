import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { apiAs, createStaff, horizontalOverflow, newSession, signIn, type Account } from "./helpers";

let editor: Account;

test.beforeAll(async () => {
  editor = await createStaff("content_editor");
});

test.describe("Embedding status (real backend)", () => {
  test("an editor finds it in the menu and sees the same numbers the backend reports", async ({ page, context }) => {
    const s = await newSession(editor);
    await signIn(context, s);
    await page.goto("/");
    await page.getByRole("link", { name: "Embedding status" }).click();
    await expect(page.getByRole("heading", { name: "Embedding status" })).toBeVisible();

    const api = await apiAs(s, "GET", "/admin/ai/embeddings/status");
    const n = (x: number) => x.toLocaleString("en-IN");
    await expect(page.getByRole("status")).toContainText(api.pending_total === 0 ? "All caught up" : `${n(api.pending_total)} question`);
    await expect(page.locator("dt", { hasText: "Ready" }).locator("+ dd")).toHaveText(n(api.totals.ready));
    await expect(page.locator("dt", { hasText: "Published" }).locator("+ dd")).toHaveText(n(api.totals.published));
    await expect(page.getByRole("heading", { name: "By exam" })).toBeVisible();
    for (const e of api.exams.slice(0, 3)) await expect(page.getByRole("region", { name: "Embedding status by exam" })).toContainText(e.exam_slug);
  });

  for (const width of [768, 1280])
    test(`fits and is accessible @${width}`, async ({ page, context }) => {
      await signIn(context, await newSession(editor));
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/embeddings");
      await expect(page.getByRole("heading", { name: "Embedding status" })).toBeVisible();
      await page.waitForLoadState("networkidle").catch(() => {});
      expect(await horizontalOverflow(page), "page scrolls sideways").toBeLessThanOrEqual(0);
      const bad = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
});
