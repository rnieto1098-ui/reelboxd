import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runJob } from "@/lib/jobs";

// Runs daily (see vercel.json). The work itself, and the record of each run
// shown in the admin area, live in lib/jobs.ts. See lib/cronAuth.ts for how
// a real scheduled trigger is told apart from anyone who finds the URL.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runJob("letterboxd-watchlist-sync", "cron");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
