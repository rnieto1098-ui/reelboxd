import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { hasAdminRole, requireAdmin } from "@/lib/admin";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { Pagination } from "@/components/Pagination";
import { avatarSrc } from "@/lib/avatars";

const PAGE_SIZE = 25;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Matches part of a username or an email address. SQLite compares these
  // without regard to case for plain letters, so "RYAN" finds "ryan".
  const where = query
    ? { OR: [{ username: { contains: query } }, { email: { contains: query } }] }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        username: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        letterboxdUsername: true,
        _count: { select: { diaryEntries: true, ratings: true, lists: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (targetPage: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (targetPage > 1) search.set("page", String(targetPage));
    const qs = search.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {total.toLocaleString("en-US")} {query ? "matching " : ""}
          {total === 1 ? "member" : "members"}
          {query && (
            <>
              {" "}
              for &ldquo;{query}&rdquo;.{" "}
              <Link href="/admin/users" className="text-accent-green hover:underline">
                Clear
              </Link>
            </>
          )}
        </p>
        <form action="/admin/users" role="search" className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by username or email"
            aria-label="Search members by username or email"
            className="input pl-9"
          />
        </form>
      </div>

      {users.length === 0 ? (
        <p className="rounded-[0.875rem] border border-dashed border-border-strong px-6 py-10 text-center text-sm text-muted">
          No members match that search.
        </p>
      ) : (
        <div className="card relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
                <th scope="col" className="px-4 py-3">
                  Member
                </th>
                <th scope="col" className="px-4 py-3">
                  Joined
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Logged
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Rated
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Lists
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isAdmin = hasAdminRole(user);
                return (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background text-xs font-bold text-accent-green ring-1 ring-white/10">
                          <Image
                            src={avatarSrc(user.image, user.username)}
                            alt=""
                            width={36}
                            height={36}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/profile/${user.username}`}
                              className="truncate font-semibold hover:text-accent-green"
                            >
                              {user.username}
                            </Link>
                            {isAdmin && (
                              <span className="rounded-full bg-accent-green px-1.5 py-px text-[10px] font-semibold text-black">
                                Admin
                              </span>
                            )}
                            {user.id === admin.id && (
                              <span className="text-[11px] text-subtle">(you)</span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                        </div>
                      </div>
                    </th>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {user.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {user._count.diaryEntries.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {user._count.ratings.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{user._count.lists}</td>
                    <td className="px-4 py-2">
                      <AdminUserActions
                        userId={user.id}
                        username={user.username}
                        isAdmin={user.role === "ADMIN"}
                        isSelf={user.id === admin.id}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </div>
  );
}
