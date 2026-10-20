"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import Badge from "@/components/kit/Badge";
import Button from "@/components/kit/Button";
import ConfirmDialog from "@/components/kit/ConfirmDialog";
import DataTable, { type Column } from "@/components/kit/DataTable";
import ErrorState from "@/components/kit/ErrorState";
import ExamSelect from "@/components/kit/ExamSelect";
import Field from "@/components/kit/Field";
import type { PyqYear, PyqYearAction } from "@/lib/api/papers";
import { usePyqYearMutations, usePyqYears } from "@/lib/hooks/usePapers";

type Action = "publish" | "unpublish" | "free" | "paid";

const TITLE: Record<Action, string> = { publish: "Publish this year?", unpublish: "Unpublish this year?", free: "Make this year free?", paid: "Make this year paid?" };
const CONFIRM: Record<Action, string> = { publish: "Publish year", unpublish: "Unpublish year", free: "Make free", paid: "Make paid" };
const EXPLAIN: Record<Action, string> = {
  publish: "Every paper of this year that has at least one published question becomes visible to students. Papers whose questions are all still in review are skipped: approve them in the review queue first.",
  unpublish: "Students will no longer see this year or its papers. Questions keep their status, and tests already built keep working.",
  free: "Every student can study and practise this year, even without buying the exam's test series.",
  paid: "Only students who bought the exam's test series can open this year.",
};

function resultMessage(a: Action, r: PyqYearAction): string {
  const n = r.changed.length;
  const papers = (k: number) => `${k} paper${k === 1 ? "" : "s"}`;
  if (a === "publish") return n ? `Published ${papers(n)} of ${r.year}.${r.skipped.length ? ` ${papers(r.skipped.length)} skipped: no published questions yet.` : ""}` : r.skipped.length ? `Nothing published: ${papers(r.skipped.length)} still have no published questions.` : "Already published.";
  if (a === "unpublish") return n ? `Unpublished ${papers(n)} of ${r.year}.` : "Already unpublished.";
  return n ? `${r.year} is now ${a === "free" ? "free for every student" : "paid"}.` : `${r.year} was already ${a}.`;
}

/**
 * Previous-year questions grouped by exam and year. Compilation books split one sitting into many small papers, so
 * the year is what students practise: staff publish a whole year and make it free or paid here in one step.
 */
export default function PyqYearsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const exam = params.get("exam") ?? "";
  const q = usePyqYears(exam);
  const m = usePyqYearMutations();
  const [action, setAction] = useState<{ type: Action; row: PyqYear } | null>(null);
  const mut = action ? m[action.type] : null;
  const label = (r: PyqYear) => `${r.exam_name} ${r.year}`;

  const columns: Column<PyqYear>[] = [
    ...(exam ? [] : [{ key: "e", header: "Exam", cell: (r: PyqYear) => <span className="font-semibold">{r.exam_name}</span> }]),
    { key: "y", header: "Year", cell: (r) => <span className="text-base font-extrabold tabular-nums">{r.year}</span> },
    {
      key: "s",
      header: "Students see",
      cell: (r) =>
        r.visible_to_students ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="whitespace-nowrap font-semibold">{r.visible_to_students} questions</span>
            {r.is_free ? <Badge tone="success">Free</Badge> : <Badge tone="info">Paid</Badge>}
          </div>
        ) : (
          <Badge tone="warning">Not visible yet</Badge>
        ),
    },
    {
      key: "q",
      header: "Questions",
      cell: (r) => (
        <span className="whitespace-nowrap text-ink-muted">
          <span className="font-semibold text-ink">{r.published}</span> published
          {r.in_review > 0 && (
            <>
              {" · "}
              <Link href={`/questions?exam=${encodeURIComponent(r.exam_slug)}&status=in_review`} className="font-semibold text-primary hover:underline">
                {r.in_review} in review<span className="sr-only"> for {r.exam_name}</span>
              </Link>
            </>
          )}
          {r.draft > 0 && ` · ${r.draft} draft`}
        </span>
      ),
    },
    {
      key: "p",
      header: "Papers",
      cell: (r) => (
        <Link href={`/papers?exam=${encodeURIComponent(r.exam_slug)}`} className="whitespace-nowrap font-semibold text-primary hover:underline">
          {r.papers_published} of {r.papers} published<span className="sr-only"> for {label(r)}</span>
        </Link>
      ),
    },
    {
      key: "a",
      header: "Actions",
      cell: (r) => (
        <div className="flex flex-wrap gap-2">
          {r.papers_published < r.papers && (
            <Button className="!min-h-[36px] !px-3" onClick={() => setAction({ type: "publish", row: r })}>
              Publish<span className="sr-only"> {label(r)}</span>
            </Button>
          )}
          {r.papers_published > 0 && (
            <Button variant="ghost" className="!min-h-[36px] !px-3" onClick={() => setAction({ type: "unpublish", row: r })}>
              Unpublish<span className="sr-only"> {label(r)}</span>
            </Button>
          )}
          {r.papers_free < r.papers ? (
            <Button variant="secondary" className="!min-h-[36px] !px-3" onClick={() => setAction({ type: "free", row: r })}>
              Make free<span className="sr-only"> {label(r)}</span>
            </Button>
          ) : (
            <Button variant="secondary" className="!min-h-[36px] !px-3" onClick={() => setAction({ type: "paid", row: r })}>
              Make paid<span className="sr-only"> {label(r)}</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  const rows = q.data ?? [];
  const exams = new Set(rows.map((r) => r.exam_slug)).size;
  const visible = rows.reduce((a, r) => a + r.visible_to_students, 0);
  const waiting = rows.reduce((a, r) => a + r.in_review, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">PYQ by year</h1>
        <p className="mt-1 text-sm text-ink-muted">Previous-year questions grouped by exam and year. Students practise a whole year at once. Publish a year when its questions are reviewed, and choose whether it is free or needs the exam&apos;s test series.</p>
      </div>

      <div className="max-w-sm">
        <Field label="Exam">{(p) => <ExamSelect {...p} allLabel="All exams" value={exam} onChange={(v) => router.replace(v ? `${pathname}?exam=${encodeURIComponent(v)}` : pathname, { scroll: false })} />}</Field>
      </div>

      {q.data && rows.length > 0 && (
        <p className="text-sm text-ink-muted">
          {rows.length} year{rows.length === 1 ? "" : "s"}
          {!exam && ` across ${exams} exam${exams === 1 ? "" : "s"}`} · {visible} questions visible to students{waiting > 0 && ` · ${waiting} still in review`}
        </p>
      )}

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          caption={exam ? "Years for this exam" : "Years for every exam"}
          columns={columns}
          rows={rows}
          rowKey={(r) => `${r.exam_slug}-${r.year}`}
          loading={q.isPending}
          empty={
            <>
              <p className="font-semibold text-ink">No previous-year papers {exam ? "for this exam " : ""}yet</p>
              <p className="mt-1">Upload questions in JSON imports or PDF extraction; their papers appear here by year.</p>
            </>
          }
        />
      )}

      <ConfirmDialog
        open={!!action}
        title={action ? TITLE[action.type] : ""}
        confirmLabel={action ? CONFIRM[action.type] : ""}
        danger={action?.type === "unpublish"}
        busy={mut?.isPending}
        error={mut?.error}
        onCancel={() => {
          mut?.reset();
          setAction(null);
        }}
        onConfirm={async () => {
          if (!action || !mut) return;
          try {
            const r = await mut.mutateAsync({ exam: action.row.exam_slug, year: action.row.year });
            toast.success(resultMessage(action.type, r));
            setAction(null);
          } catch {}
        }}
      >
        {action && (
          <>
            <p className="rounded-lg bg-bg-tint px-3 py-2 text-ink">
              <strong>{label(action.row)}</strong> · {action.row.papers} paper{action.row.papers === 1 ? "" : "s"}, {action.row.published} published questions
            </p>
            <p>{EXPLAIN[action.type]}</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
