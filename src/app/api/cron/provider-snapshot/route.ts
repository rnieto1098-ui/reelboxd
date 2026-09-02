import { NextResponse } from "next/server";
import { runProviderSnapshot } from "@/lib/providerSnapshot";

// Runs daily (see vercel.json) to detect movies that newly picked up a
// streaming provider — see lib/providerSnapshot.ts for why this has to be
// done as a self-maintained diff rather than read from TMDB directly.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runProviderSnapshot();
  return NextResponse.json(result);
}
