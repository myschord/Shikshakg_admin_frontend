import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { apiAs, createStaff, horizontalOverflow, newSession, signIn, type Account } from "./helpers";

let editor: Account;
type Year = { exam_slug: string; year: number; papers: number; visible_to_students: number; is_free: boolean };

test.beforeAll(async () => {
  editor = await createStaff("content_editor");
});

test.describe("PYQ by year (real backend)", () => {
  test("lists every exam's years, then one exam's, and toggles a year free and back", async ({ page, context }) => {
    const s = await newSession(editor);
    await signIn(context, s);
    await page.goto("/");
    await page.getByRole("link", { name: "PYQ by year" }).click();
    await expect(page.getByRole("heading", { name: "PYQ by year" })).toBeVisible();

    const all: Year[] = await apiAs(s, "GET", "/admin/pyq/years");
    test.skip(all.length === 0, "the local database has no papers");
    await expect(page.getByRole("region", { name: "Years for every exam" })).toBeVisible();

    // Pick an exam that has a year students can already see, so the free/paid toggle is meaningful.
    const target = all.find((y) => y.visible_to_students > 0) ?? all[0];
    await page.getByLabel("Exam", { exact: true }).selectOption(target.exam_slug);
    await expect(page).toHaveURL(new RegExp(`exam=${target.exam_slug}`));
    const table = page.getByRole("region", { name: "Years for this exam" });
    await expect(table).toContainText(String(target.year));

    const toggle = target.is_free ? "Make paid" : "Make free";
    const back = target.is_free ? "Make free" : "Make paid";
    await table.getByRole("button", { name: new RegExp(`^${toggle} .* ${target.year}$`) }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: toggle }).click();
    await expect(page.getByText(new RegExp(`${target.year} is now`))).toBeVisible();
    const after: Year[] = await apiAs(s, "GET", `/admin/pyq/years?exam=${target.exam_slug}`);
    expect(after.find((y) => y.year === target.year)?.is_free).toBe(!target.is_free);

    // Put it back as it was.
    await table.getByRole("button", { name: new RegExp(`^${back} .* ${target.year}$`) }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: back }).click();
    await expect.poll(async () => ((await apiAs(s, "GET", `/admin/pyq/years?exam=${target.exam_slug}`)) as Year[]).find((y) => y.year === target.year)?.is_free).toBe(target.is_free);
  });

  for (const width of [768, 1280])
    test(`fits and is accessible @${width}`, async ({ page, context }) => {
      await signIn(context, await newSession(editor));
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/pyq-years");
      await expect(page.getByRole("heading", { name: "PYQ by year" })).toBeVisible();
      await page.waitForLoadState("networkidle").catch(() => {});
      expect(await horizontalOverflow(page), "page scrolls sideways").toBeLessThanOrEqual(0);
      const bad = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
});
