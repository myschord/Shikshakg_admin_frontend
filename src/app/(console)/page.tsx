"use client";

import Link from "next/link";
import { CalendarClock, CheckCircle2, CircleDashed } from "lucide-react";
import ErrorState from "@/components/kit/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth/AuthContext";
import { useStale } from "@/lib/hooks/useExamEvents";

const LATER = ["Questions waiting for review", "Open student reports", "Pending refunds", "Failed imports", "Suspicious AI questions"];

/** The day's work queues. Only queues whose screens exist show real counts. */
export default function TodayPage() {
  const { user } = useAuth();
  const stale = useStale(30, 60);
  const first = user?.full_name.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Today{first ? `, ${first}` : ""}</h1>
        <p className="mt-1 text-sm text-ink-muted">What needs a person today.</p>
      </div>

      <section aria-labelledby="queues" className="grid gap-4 sm:grid-cols-2">
        <h2 id="queues" className="sr-only">
          Work queues
        </h2>
        <article className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-border-tint text-primary-dark">
              <CalendarClock className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">Exam dates to recheck</h3>
              {stale.isPending ? (
                <Skeleton className="mt-2 h-8 w-24" />
              ) : stale.isError ? (
                <div className="mt-2">
                  <ErrorState compact error={stale.error} onRetry={() => stale.refetch()} />
                </div>
              ) : (
                <>
                  <p className="mt-1 text-3xl font-extrabold tabular-nums">{stale.data.length}</p>
                  <p className="text-sm text-ink-muted">
                    {stale.data.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-success-text" aria-hidden /> Everything starting soon was checked recently.
                      </span>
                    ) : (
                      "Published dates starting within 60 days, last checked over 30 days ago."
                    )}
                  </p>
                  <Link href="/exam-dates/stale" className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-primary hover:underline">
                    Open the queue
                  </Link>
                </>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-dashed border-line bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-ink-muted">
              <CircleDashed className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-bold">More queues are coming</h3>
              <p className="mt-1 text-sm text-ink-muted">These appear here as their screens are built:</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
                {LATER.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
