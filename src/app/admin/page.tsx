import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Bookmark,
  Film,
  Gamepad2,
  ListChecks,
  RefreshCw,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { CHART_DAYS, getAdminOverview } from "@/lib/adminStats";

const number = (n: number) => n.toLocaleString("en-US");

function shortDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function StatTile({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <Icon aria-hidden className="h-4 w-4 text-accent-green" strokeWidth={1.9} />
        {label}
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums tracking-tight">
        {number(value)}
      </p>
      {note && <p className="mt-1 text-xs text-subtle">{note}</p>}
    </div>
  );
}

// A column per day. The numbers behind it are in a table for screen readers
// (and anyone who wants exact figures) directly underneath, collapsed.
function DayChart({
  title,
  unit,
  data,
}: {
  title: string;
  unit: string;
  data: { day: string; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-sans text-sm font-semibold tracking-normal">{title}</h2>
        <p className="text-xs text-muted">
          {number(total)} in the last {CHART_DAYS} days
        </p>
      </div>
      <div
        role="img"
        aria-label={`${title}: ${number(total)} in the last ${CHART_DAYS} days. Daily figures are in the table below.`}
        className="flex h-32 items-end gap-[3px]"
      >
        {data.map((d) => (
          <div
            key={d.day}
            title={`${shortDate(d.day)}: ${d.count} ${unit}${d.count === 1 ? "" : "s"}`}
            className="group flex h-full flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-sm transition-colors ${
                d.count > 0
                  ? "bg-accent-green/70 group-hover:bg-accent-green"
                  : "bg-white/[0.06]"
              }`}
              // Days with nothing still get a sliver, so the axis reads as
              // 30 separate days rather than a gap.
              style={{ height: d.count > 0 ? `${Math.max(6, (d.count / max) * 100)}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-subtle">
        <span>{shortDate(data[0].day)}</span>
        <span>{shortDate(data[data.length - 1].day)}</span>
      </div>
      <details className="mt-3 text-xs">
        <summary className="text-muted hover:text-foreground">Daily figures</summary>
        <table className="mt-2 w-full">
          <thead className="sr-only">
            <tr>
              <th>Day</th>
              <th>{title}</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.day} className="border-t border-border">
                <td className="py-1 text-muted">{shortDate(d.day)}</td>
                <td className="py-1 text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const { totals, signupsByDay, logsByDay, newestUsers, mostActive, topFilms } =
    await getAdminOverview();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon={Users}
          label="Members"
          value={totals.users}
          note={`${number(totals.usersWeek)} joined this week`}
        />
        <StatTile
          icon={BookOpen}
          label="Films logged"
          value={totals.diary}
          note={`${number(totals.diaryWeek)} this week`}
        />
        <StatTile icon={Star} label="Ratings" value={totals.ratings} />
        <StatTile icon={Bookmark} label="Watchlist films" value={totals.watchlistItems} />
        <StatTile icon={ListChecks} label="Member lists" value={totals.userLists} />
        <StatTile icon={Trophy} label="Challenges" value={totals.challenges} />
        <StatTile icon={Gamepad2} label="Daily games finished today" value={totals.gamesToday} />
        <StatTile
          icon={RefreshCw}
          label="Letterboxd accounts linked"
          value={totals.letterboxdConnected}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DayChart title="New members" unit="member" data={signupsByDay} />
        <DayChart title="Films logged" unit="film" data={logsByDay} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-sans text-sm font-semibold tracking-normal">Newest members</h2>
            <Link href="/admin/users" className="text-xs text-muted hover:text-accent-green">
              All users
            </Link>
          </div>
          <ul className="space-y-3">
            {newestUsers.map((user) => (
              <li key={user.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background text-xs font-bold text-accent-green ring-1 ring-white/10">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.username[0]?.toUpperCase()
                  )}
                </span>
                <Link
                  href={`/profile/${user.username}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent-green"
                >
                  {user.username}
                </Link>
                <span className="shrink-0 text-xs text-subtle">
                  {shortDate(user.createdAt.toISOString().slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal">
            Most active, last {CHART_DAYS} days
          </h2>
          {mostActive.length === 0 ? (
            <p className="text-sm text-muted">Nobody has logged a film in this period.</p>
          ) : (
            <ol className="space-y-3">
              {mostActive.map((user, i) => (
                <li key={user.username} className="flex items-center gap-3 text-sm">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-subtle">{i + 1}</span>
                  <Link
                    href={`/profile/${user.username}`}
                    className="min-w-0 flex-1 truncate font-medium hover:text-accent-green"
                  >
                    {user.username}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {user.count} film{user.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal">
            Most logged films, last {CHART_DAYS} days
          </h2>
          {topFilms.length === 0 ? (
            <p className="text-sm text-muted">No films logged in this period.</p>
          ) : (
            <ol className="space-y-3">
              {topFilms.map(({ movie, count }, i) => (
                <li key={movie.id} className="flex items-center gap-3 text-sm">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-subtle">{i + 1}</span>
                  <Link
                    href={`/movie/${movie.tmdbId}`}
                    className="min-w-0 flex-1 truncate font-medium hover:text-accent-green"
                  >
                    {movie.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {count} log{count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <p className="flex items-center gap-2 text-xs text-subtle">
        <Film aria-hidden className="h-3.5 w-3.5" />
        {number(totals.moviesCached)} films cached from TMDB.
      </p>
    </div>
  );
}
