"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "react-toastify";
import Badge from "@/components/kit/Badge";
import Button from "@/components/kit/Button";
import ConfirmDialog from "@/components/kit/ConfirmDialog";
import DataTable, { type Column } from "@/components/kit/DataTable";
import Dialog from "@/components/kit/Dialog";
import ErrorState from "@/components/kit/ErrorState";
import ExamSelect from "@/components/kit/ExamSelect";
import Field, { inputClass } from "@/components/kit/Field";
import MockBanner from "@/components/kit/MockBanner";
import { CA_MOVES, CA_STATUS_LABEL, IMPORTANCE_LABEL, type CaInput, type CaItem, type CaStatus, type Importance } from "@/lib/api/a8";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatDay, todayIst } from "@/lib/date";
import { useCaItems, useCaMutations } from "@/lib/hooks/useA8";
import { useCategories, useExam } from "@/lib/hooks/useExamEvents";
import { useSyllabus } from "@/lib/hooks/useQuestions";

const TONE = { draft: "warning", in_review: "info", published: "success", retired: "neutral" } as const;
const MOVE_LABEL: Record<CaStatus, string> = { in_review: "Send for review", published: "Publish", draft: "Back to draft", retired: "Retire" };
const https = (v: string) => /^https:\/\/[^\s]+$/.test(v);

/** Daily news items for students, written here and checked before they go live. Editors write, administrators publish. */
export default function CurrentAffairsScreen() {
  const { user } = useAuth();
  const categories = useCategories();
  const [exam, setExam] = useState("");
  const [status, setStatus] = useState("");
  const list = useCaItems({ exam: exam || undefined, status: status || undefined });
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const m = useCaMutations();
  const [form, setForm] = useState<{ item?: CaItem } | null>(null);
  const [move, setMove] = useState<{ item: CaItem; to: CaStatus } | null>(null);
  const [note, setNote] = useState("");

  const columns: Column<CaItem>[] = [
    {
      key: "t",
      header: "Item",
      cell: (c) => (
        <>
          <span className="font-semibold">{c.title}</span>
          <span className="block max-w-md truncate text-xs text-ink-muted">{c.summary}</span>
        </>
      ),
    },
    { key: "e", header: "Exam", cell: (c) => c.exam_slug },
    { key: "d", header: "News of", cell: (c) => <span className="whitespace-nowrap">{formatDay(c.published_on)}</span> },
    { key: "i", header: "Importance", cell: (c) => IMPORTANCE_LABEL[c.importance] },
    { key: "s", header: "State", cell: (c) => <Badge tone={TONE[c.status]}>{CA_STATUS_LABEL[c.status]}</Badge> },
    {
      key: "a",
      header: "Actions",
      cell: (c) => (
        <div className="flex flex-wrap gap-2">
          {(c.status === "draft" || c.status === "in_review") && (
            <Button variant="secondary" className="!min-h-[36px] !px-3" onClick={() => setForm({ item: c })}>
              Edit<span className="sr-only"> {c.title}</span>
            </Button>
          )}
          {CA_MOVES[c.status].map((to) =>
            to === "published" && user?.role !== "admin" ? null : (
              <Button key={to} variant={to === "published" ? "primary" : "ghost"} className="!min-h-[36px] !px-3" onClick={() => { setNote(""); setMove({ item: c, to }); }}>
                {MOVE_LABEL[to]}
                <span className="sr-only"> {c.title}</span>
              </Button>
            ),
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Current affairs</h1>
          <p className="mt-1 text-sm text-ink-muted">Short news items with a source link, shown to students of an exam once published.</p>
        </div>
        <Button onClick={() => setForm({})} icon={<Plus className="h-4 w-4" aria-hidden />}>
          New item
        </Button>
      </div>
      <MockBanner what="current-affairs routes" />
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Exam" className="min-w-[14rem]">{(p) => <ExamSelect {...p} allLabel="All exams" value={exam} onChange={setExam} />}</Field>
        <Field label="State" className="min-w-[10rem]">
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">All</option>
              {Object.entries(CA_STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : <DataTable caption="Current affairs items" columns={columns} rows={rows} rowKey={(c) => c.id} loading={list.isPending || categories.isPending} empty={<p className="font-semibold text-ink">No items</p>} />}
      <ItemForm open={!!form} item={form?.item} defaultExam={exam} onClose={() => setForm(null)} />
      <ConfirmDialog
        open={!!move}
        title={move ? `${MOVE_LABEL[move.to]}?` : ""}
        confirmLabel={move ? MOVE_LABEL[move.to] : ""}
        danger={move?.to === "retired"}
        busy={m.setStatus.isPending}
        error={m.setStatus.error}
        onCancel={() => {
          m.setStatus.reset();
          setMove(null);
        }}
        onConfirm={async () => {
          if (!move) return;
          try {
            await m.setStatus.mutateAsync({ id: move.item.id, status: move.to, note: note.trim() || undefined });
            toast.success("Done.");
            setMove(null);
          } catch {}
        }}
      >
        {move && (
          <>
            <p className="rounded-lg bg-bg-tint px-3 py-2 text-ink">
              <strong>{move.item.title}</strong> is {CA_STATUS_LABEL[move.item.status].toLowerCase()}.
            </p>
            {move.to === "published" && <p>Students of {move.item.exam_slug} will see it.</p>}
            {move.to === "retired" && <p>Students will no longer see it.</p>}
            <Field label="Note (optional)">{(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={inputClass} />}</Field>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function ItemForm({ open, item, defaultExam, onClose }: { open: boolean; item?: CaItem; defaultExam: string; onClose: () => void }) {
  const edit = !!item;
  const categories = useCategories();
  const { create, update } = useCaMutations();
  const [exam, setExam] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [on, setOn] = useState("");
  const [importance, setImportance] = useState<Importance>("medium");
  const [topics, setTopics] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const examValue = exam || item?.exam_slug || defaultExam || categories.data?.[0]?.exams[0]?.slug || "";
  const examData = useExam(examValue || null);
  const stage = examData.data?.stages?.[0]?.slug ?? null;
  const syllabus = useSyllabus(examValue || null, (examData.data?.stages?.length ?? 0) > 1 ? stage : null);
  const allTopics = useMemo(() => (syllabus.data?.subjects ?? []).flatMap((s) => s.topics.map((t) => ({ id: t.id, name: `${s.name}: ${t.name}` }))), [syllabus.data]);
  const mut = edit ? update : create;

  useEffect(() => {
    if (!open) return;
    setExam(item?.exam_slug ?? "");
    setTitle(item?.title ?? "");
    setSummary(item?.summary ?? "");
    setSourceName(item?.source_name ?? "");
    setSourceUrl(item?.source_url ?? "");
    setOn(item?.published_on ?? todayIst());
    setImportance(item?.importance ?? "medium");
    setTopics(item?.topic_ids ?? []);
    setErrors({});
    create.reset();
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!title.trim()) err.title = "Write the headline.";
    if (!summary.trim()) err.summary = "Write a short summary.";
    if (!sourceName.trim()) err.sourceName = "Name the source, for example PIB.";
    if (!https(sourceUrl.trim())) err.sourceUrl = "Enter the source link, starting with https://.";
    if (!on) err.on = "Choose the day of the news.";
    else if (on > todayIst()) err.on = "The news cannot be from a future day.";
    setErrors(err);
    if (Object.keys(err).length) return;
    const body: CaInput = { exam_slug: examValue, title: title.trim(), summary: summary.trim(), source_name: sourceName.trim(), source_url: sourceUrl.trim(), published_on: on, importance, topic_ids: topics };
    try {
      if (edit) await update.mutateAsync({ id: item!.id, body });
      else await create.mutateAsync(body);
      toast.success(edit ? "Saved." : "Item saved as a draft.");
      onClose();
    } catch {}
  }

  return (
    <Dialog open={open} title={edit ? "Edit item" : "New item"} onClose={onClose} busy={mut.isPending} wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Exam" required>{(p) => <ExamSelect {...p} value={examValue} onChange={setExam} disabled={edit} />}</Field>
          <Field label="Day of the news" required error={errors.on}>{(p) => <input {...p} type="date" max={todayIst()} value={on} onChange={(e) => setOn(e.target.value)} className={inputClass} />}</Field>
        </div>
        <Field label="Headline" required error={errors.title} help={`${title.length} of 200`}>{(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputClass} />}</Field>
        <Field label="Summary" required error={errors.summary} help={`${summary.length} of 600. Say what happened and why an aspirant should care.`}>{(p) => <textarea {...p} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={600} rows={4} className={`${inputClass} py-2`} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source name" required error={errors.sourceName}>{(p) => <input {...p} value={sourceName} onChange={(e) => setSourceName(e.target.value)} maxLength={80} className={inputClass} />}</Field>
          <Field label="Source link" required error={errors.sourceUrl}>{(p) => <input {...p} type="url" inputMode="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" className={inputClass} />}</Field>
          <Field label="Importance">
            {(p) => (
              <select {...p} value={importance} onChange={(e) => setImportance(e.target.value as Importance)} className={inputClass}>
                {(Object.keys(IMPORTANCE_LABEL) as Importance[]).map((i) => (
                  <option key={i} value={i}>
                    {IMPORTANCE_LABEL[i]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Topics it relates to (optional)</legend>
          {syllabus.isPending ? (
            <p className="text-sm text-ink-muted">Loading topics…</p>
          ) : allTopics.length === 0 ? (
            <p className="text-sm text-ink-muted">This exam has no topics yet.</p>
          ) : (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {allTopics.map((t) => (
                <label key={t.id} className="flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm hover:bg-bg-tint">
                  <input type="checkbox" checked={topics.includes(t.id)} onChange={(e) => setTopics((cur) => (e.target.checked ? [...cur, t.id] : cur.filter((x) => x !== t.id)))} className="h-4 w-4 accent-primary" />
                  {t.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        {mut.error ? <ErrorState compact error={mut.error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={mut.isPending}>
            {edit ? "Save changes" : "Save draft"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
