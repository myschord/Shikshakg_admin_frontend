"use client";

import { useMemo } from "react";
import { BookOpenCheck, ClipboardList, FileText, PlayCircle, Sparkles } from "lucide-react";
import type { components } from "@/lib/api/schema";
import { useSeries } from "@/lib/hooks/usePapers";
import { useCourses } from "@/lib/hooks/useCourses";

type Item = components["schemas"]["ProductComponentIn"];

/** What a product grants, as the student will read it. */
export function contentsSummary(items: { title?: string }[]): string {
  return items.map((i) => i.title).filter(Boolean).join(" + ");
}

const key = (i: Item) => `${i.entitlement_type}|${i.course_id ?? ""}|${i.test_series_id ?? ""}`;
const ALL_TESTS: Item = { entitlement_type: "TEST_SERIES_ACCESS" };
const ALL_COURSES: Item = { entitlement_type: "COURSE_ACCESS" };
const PYQ: Item = { entitlement_type: "PYQ_ACCESS" };

/**
 * "What is inside this product" — the admin ticks exactly what a buyer gets, the way test-prep
 * stores list a pass: one series, a whole course, only previous-year papers, or everything.
 * Buyers get these items and nothing else.
 */
export default function ProductContents({ exam, value, onChange, error }: { exam: string; value: Item[]; onChange: (items: Item[]) => void; error?: string }) {
  const series = useSeries(exam || undefined);
  const courses = useCourses({ exam: exam || undefined });
  const seriesList = useMemo(() => (series.data ?? []).filter((s) => s.status !== "archived"), [series.data]);
  const courseList = useMemo(() => courses.data?.pages.flatMap((p) => p.items).filter((c) => c.status !== "archived") ?? [], [courses.data]);
  const has = (i: Item) => value.some((v) => key(v) === key(i));
  const toggle = (i: Item) => onChange(has(i) ? value.filter((v) => key(v) !== key(i)) : [...value, i]);
  const allTests = has(ALL_TESTS);
  const allCourses = has(ALL_COURSES);

  const presets: { label: string; items: Item[] }[] = [
    { label: "Previous-year papers only", items: [PYQ] },
    { label: "Everything for the exam", items: [ALL_TESTS, ALL_COURSES] },
    { label: "Start over", items: [] },
  ];

  return (
    <fieldset className="space-y-4 rounded-xl border border-border-tint p-4" aria-describedby={error ? "contents-err" : undefined}>
      <legend className="px-1 text-sm font-semibold text-ink">What is inside this product</legend>
      <p className="text-sm text-ink-muted">Pick what students get when they buy it. They get these and nothing else, so a buyer of one series cannot open the others.</p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick choices">
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => onChange(p.items)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border-tint bg-white px-3 text-xs font-semibold text-primary-dark hover:border-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {p.label}
          </button>
        ))}
      </div>

      <Group icon={FileText} title="Previous-year papers (PYQ)" help="Every paper of this exam, with answers and timed practice.">
        <Check checked={has(PYQ)} onChange={() => toggle(PYQ)} label="All previous-year papers" />
      </Group>

      <Group icon={ClipboardList} title="Test series" help="Mock tests. Pick the series you want to sell, or give access to all of them.">
        <Check checked={allTests} onChange={() => toggle(ALL_TESTS)} label="All test series, PYQs and practice tools" hint="Includes every series, now and later. Use for a full pass." />
        {!allTests &&
          (series.isPending ? (
            <p className="text-sm text-ink-muted">Loading test series…</p>
          ) : seriesList.length === 0 ? (
            <p className="text-sm text-ink-muted">This exam has no test series yet. Create one in Tests first.</p>
          ) : (
            seriesList.map((s) => {
              const item: Item = { entitlement_type: "TEST_SERIES_ACCESS", test_series_id: s.id };
              return <Check key={s.id} checked={has(item)} onChange={() => toggle(item)} label={s.title} hint={`${s.test_count} test${s.test_count === 1 ? "" : "s"}${s.status === "published" ? "" : " · not published yet"}`} />;
            })
          ))}
      </Group>

      <Group icon={PlayCircle} title="Video courses" help="Pick the courses to sell, or give access to all of them.">
        <Check checked={allCourses} onChange={() => toggle(ALL_COURSES)} label="All video courses" hint="Includes every course, now and later." />
        {!allCourses &&
          (courses.isPending ? (
            <p className="text-sm text-ink-muted">Loading courses…</p>
          ) : courseList.length === 0 ? (
            <p className="text-sm text-ink-muted">This exam has no courses yet. Create one in Courses first.</p>
          ) : (
            courseList.map((c) => {
              const item: Item = { entitlement_type: "COURSE_ACCESS", course_id: c.id };
              return <Check key={c.id} checked={has(item)} onChange={() => toggle(item)} label={c.title} hint={`${c.lecture_count} lecture${c.lecture_count === 1 ? "" : "s"}${c.status === "published" ? "" : " · not published yet"}`} />;
            })
          ))}
      </Group>

      <p className="flex items-start gap-2 rounded-lg bg-bg-tint px-3 py-2 text-sm text-ink" aria-live="polite">
        <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>{value.length === 0 ? "Nothing selected yet." : `${value.length} item${value.length === 1 ? "" : "s"} selected.`}</span>
      </p>
      {error ? (
        <p id="contents-err" role="alert" className="text-sm font-medium text-error-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Group({ icon: Icon, title, help, children }: { icon: React.ElementType; title: string; help: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <Icon className="h-4 w-4 text-primary" aria-hidden /> {title}
        </p>
        <p className="text-xs text-ink-muted">{help}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${checked ? "border-primary bg-bg-tint" : "border-border-tint bg-white hover:border-primary/40"}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
      <span className="min-w-0">
        <span className="block font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}
