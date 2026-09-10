import { NextResponse } from "next/server";
import { runProviderSnapshot } from "@/lib/providerSnapshot";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

// Runs daily (see vercel.json) to detect movies that newly picked up a
// streaming provider — see lib/providerSnapshot.ts for why this has to be
// done as a self-maintained diff rather than read from TMDB directly. See
// lib/cronAuth.ts for how a real cron trigger is told apart from anyone who
// finds the URL.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runProviderSnapshot();
  return NextResponse.json(result);
}
