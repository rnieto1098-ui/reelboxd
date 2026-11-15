import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { JOBS, JOB_KEYS, type JobKey } from "@/lib/jobs";
import { RunJobButton } from "@/components/admin/RunJobButton";

const HISTORY_LENGTH = 25;
// A scheduled job that hasn't succeeded in this long is worth a warning.
const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

// This page is drawn fresh on the server for every visit, so "now" here is
// the moment of the request.
function isStale(lastSuccess: Date | undefined): boolean {
  return !lastSuccess || Date.now() - lastSuccess.getTime() > STALE_AFTER_MS;
}

function when(date: Date) {
  return `${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

function duration(startedAt: Date, finishedAt: Date | null) {
  if (!finishedAt) return "—";
  const seconds = Math.max(0, (finishedAt.getTime() - startedAt.getTime()) / 1000);
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export default async function AdminJobsPage() {
  await requireAdmin();

  const [history, lastSuccesses] = await Promise.all([
    prisma.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: HISTORY_LENGTH }),
    // The most recent successful run of each job, for the cards at the top.
    Promise.all(
      JOB_KEYS.map((job) =>
        prisma.jobRun.findFirst({ where: { job, ok: true }, orderBy: { startedAt: "desc" } })
      )
    ),
  ]);
  const lastSuccessByJob = new Map(JOB_KEYS.map((job, i) => [job, lastSuccesses[i]]));

  return (
    <div className="space-y-10">
      <section>
        <p className="mb-4 max-w-2xl text-sm text-muted">
          These run on their own every day. Each run is recorded here, so you can see that last
          night&apos;s happened and what it did, or run one yourself.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {JOB_KEYS.map((key) => {
            const job = JOBS[key];
            const last = lastSuccessByJob.get(key);
            const stale = isStale(last?.startedAt);
            return (
              <div key={key} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-sans text-[15px] font-semibold tracking-normal">
                      {job.label}
                    </h2>
                    <p className="mt-1 text-sm text-muted">{job.description}</p>
                  </div>
                  <RunJobButton job={key} label={job.label} />
                </div>
                <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <Clock aria-hidden className="h-3.5 w-3.5 shrink-0" />
                    <dt className="sr-only">Schedule</dt>
                    <dd>{job.schedule}</dd>
                  </div>
                  <div
                    className={`flex items-start gap-2 ${stale ? "text-accent-orange" : "text-muted"}`}
                  >
                    {stale ? (
                      <CircleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <CircleCheck aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-accent-green" />
                    )}
                    <dt className="sr-only">Last successful run</dt>
                    <dd>
                      {last
                        ? `Last succeeded ${when(last.startedAt)}${stale ? " (more than a day and a half ago)" : ""}`
                        : "No successful run recorded yet"}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="section-title mb-4">
          Recent runs
        </h2>
        {history.length === 0 ? (
          <p className="rounded-[0.875rem] border border-dashed border-border-strong px-6 py-10 text-center text-sm text-muted">
            Nothing recorded yet. Runs appear here from the next scheduled job onward.
          </p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
                  <th scope="col" className="px-4 py-3">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Started
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Took
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => {
                  const label = JOBS[run.job as JobKey]?.label ?? run.job;
                  // Started but never recorded finishing: either still going,
                  // or cut off by the server's time limit.
                  const unfinished = !run.finishedAt;
                  return (
                    <tr key={run.id} className="border-b border-border last:border-b-0">
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        {label}
                        <span className="ml-2 text-xs font-normal text-subtle">
                          {run.trigger === "admin" ? "run by hand" : "scheduled"}
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{when(run.startedAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                        {duration(run.startedAt, run.finishedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-start gap-1.5 ${
                            unfinished ? "text-accent-orange" : run.ok ? "text-foreground" : "text-danger"
                          }`}
                        >
                          {unfinished ? (
                            <Clock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : run.ok ? (
                            <CircleCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-green" />
                          ) : (
                            <CircleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>
                            {unfinished
                              ? "Didn't finish (still running, or stopped by the time limit)"
                              : `${run.ok ? "" : "Failed: "}${run.summary ?? ""}`}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
