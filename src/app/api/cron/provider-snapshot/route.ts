import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runJob } from "@/lib/jobs";

// Runs daily (see vercel.json) to detect movies that newly picked up a
// streaming provider — see lib/providerSnapshot.ts for why this has to be
// done as a self-maintained diff rather than read from TMDB directly. See
// lib/cronAuth.ts for how a real cron trigger is told apart from anyone who
// finds the URL.
//
// Housekeeping rides along as a second step rather than having a schedule
// of its own: it takes a moment and must not depend on the snapshot working.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await runJob("provider-snapshot", "cron");
  const maintenance = await runJob("maintenance", "cron");
  return NextResponse.json({ snapshot, maintenance }, { status: snapshot.ok ? 200 : 500 });
}
