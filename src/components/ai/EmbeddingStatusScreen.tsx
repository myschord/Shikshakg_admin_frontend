"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import Badge from "@/components/kit/Badge";
import Button from "@/components/kit/Button";
import DataTable, { type Column } from "@/components/kit/DataTable";
import ErrorState from "@/components/kit/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { EmbeddingStatus, ExamEmbeddingRow, PendingEmbedding } from "@/lib/api/ai";
import { useEmbeddingStatus } from "@/lib/hooks/useAi";

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const at = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : "never");
const n = (x: number) => x.toLocaleString("en-IN");
const STATUS_LABEL: Record<string, string> = { published: "Published", in_review: "In review", draft: "Draft", rejected: "Rejected", retired: "Retired" };

/**
 * How much of the question bank the AI can search. Published and in-review questions are embedded by a background
 * sweep every 10 minutes; this page shows what is ready, what is still waiting, and which exams the backlog is in.
 */
export default function EmbeddingStatusScreen() {
  const q = useEmbeddingStatus();
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Embedding status</h1>
          <p className="mt-1 text-sm text-ink-muted">Whether each question is ready for AI search, practice tests and recommendations. Published and in-review questions are embedded automatically.</p>
        </div>
        <Button variant="secondary" onClick={() => q.refetch()} loading={q.isFetching} icon={<RefreshCw className="h-4 w-4" aria-hidden />}>
          Refresh
        </Button>
      </div>
      {q.isPending ? <Skeleton className="h-64" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <Body s={q.data} />}
    </div>
  );
}

function Body({ s }: { s: EmbeddingStatus }) {
  const t = s.totals;
  const total = t.published + t.in_review;
  const minutes = Math.round(s.sweep_interval_seconds / 60);
  const skipped = Object.entries(s.not_indexed).filter(([, c]) => c > 0);
  return (
    <>
      {s.pending_total === 0 ? (
        <div role="status" className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success-text">
          <p className="font-semibold">All caught up. {total === 0 ? "There are no published or in-review questions yet." : `Every one of the ${n(total)} published and in-review questions is ready.`}</p>
        </div>
      ) : (
        <div role="status" className="rounded-xl border border-warning/40 bg-warning/15 p-4 text-sm text-warning-text">
          <p className="font-semibold">{n(s.pending_total)} {s.pending_total === 1 ? "question is" : "questions are"} waiting to be embedded.</p>
          <p className="mt-1">The background job runs every {minutes} minutes and works through the list. If this number does not go down after two or three runs, embedding is failing (for example the AI service is busy or refusing requests): check the worker logs.</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Ready" value={n(t.ready)} note={total ? `${Math.floor((t.ready / total) * 100)}% of ${n(total)}` : "no questions yet"} />
        <Tile label="Waiting" value={n(s.pending_total)} note={`${n(t.missing)} new, ${n(t.outdated)} edited`} />
        <Tile label="Published" value={n(t.published)} note="visible to students" />
        <Tile label="In review" value={n(t.in_review)} note="for duplicate checks" />
      </dl>

      <p className="text-xs text-ink-muted">
        Last embedded {at(s.last_embedded_at)} · checked {at(s.checked_at)} · model <span className="font-mono">{s.model}</span> (text version {s.text_version})
        {skipped.length > 0 && <> · not embedded by design: {skipped.map(([k, c]) => `${n(c)} ${(STATUS_LABEL[k] ?? k).toLowerCase()}`).join(", ")}</>}
      </p>

      <ExamTable rows={s.exams} />
      <PendingTable rows={s.pending} total={s.pending_total} />
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd>
      <dd className="text-xs text-ink-muted">{note}</dd>
    </div>
  );
}

function ExamTable({ rows }: { rows: ExamEmbeddingRow[] }) {
  const columns: Column<ExamEmbeddingRow>[] = [
    { key: "e", header: "Exam", cell: (r) => <><span className="font-semibold">{r.exam_name}</span><span className="block font-mono text-xs text-ink-muted">{r.exam_slug}</span></> },
    { key: "p", header: "Published", align: "right", cell: (r) => n(r.published) },
    { key: "r", header: "In review", align: "right", cell: (r) => n(r.in_review) },
    { key: "ok", header: "Ready", align: "right", cell: (r) => n(r.ready) },
    {
      key: "w",
      header: "Waiting",
      align: "right",
      cell: (r) => (r.missing + r.outdated === 0 ? <Badge tone="success">None</Badge> : <Badge tone="warning">{n(r.missing + r.outdated)}</Badge>),
    },
    { key: "l", header: "Last embedded", align: "right", cell: (r) => <span className="whitespace-nowrap">{at(r.last_embedded_at)}</span> },
  ];
  return (
    <section aria-labelledby="emb-exams-h" className="space-y-3">
      <h2 id="emb-exams-h" className="text-xl font-bold">
        By exam
      </h2>
      <DataTable caption="Embedding status by exam" columns={columns} rows={rows} rowKey={(r) => r.exam_id} empty={<p>No published or in-review questions yet.</p>} />
    </section>
  );
}

function PendingTable({ rows, total }: { rows: PendingEmbedding[]; total: number }) {
  if (total === 0) return null;
  const columns: Column<PendingEmbedding>[] = [
    {
      key: "q",
      header: "Question",
      cell: (r) => (
        <Link href={`/questions/view?id=${r.question_id}`} className="font-semibold text-primary hover:underline">
          {r.preview || "Open the question"}
        </Link>
      ),
    },
    { key: "e", header: "Exam", cell: (r) => <span className="font-mono text-xs">{r.exam_slug}</span> },
    { key: "s", header: "Status", cell: (r) => STATUS_LABEL[r.status] ?? r.status },
    { key: "w", header: "Why", cell: (r) => (r.reason === "missing" ? <Badge tone="info">New</Badge> : <Badge tone="neutral">Edited</Badge>) },
    { key: "u", header: "Changed", align: "right", cell: (r) => <span className="whitespace-nowrap">{at(r.updated_at)}</span> },
  ];
  return (
    <section aria-labelledby="emb-pending-h" className="space-y-3">
      <h2 id="emb-pending-h" className="text-xl font-bold">
        Waiting
      </h2>
      <p className="text-sm text-ink-muted">
        {rows.length < total ? `The ${rows.length} most recently changed of ${n(total)}.` : "Most recently changed first."} &ldquo;New&rdquo; was never embedded; &ldquo;Edited&rdquo; changed after it was embedded and will be embedded again.
      </p>
      <DataTable caption="Questions waiting to be embedded" columns={columns} rows={rows} rowKey={(r) => r.question_id} empty={null} />
    </section>
  );
}
