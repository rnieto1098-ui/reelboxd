import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { isJobKey, runJob } from "@/lib/jobs";

/** Run one of the background jobs now, from the admin area. */
export async function POST(_request: Request, context: { params: Promise<{ job: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { job } = await context.params;
  if (!isJobKey(job)) return NextResponse.json({ error: "Unknown job" }, { status: 404 });

  // Always 200: a job that ran and failed is a result to show, not a
  // request that went wrong. `ok` in the body says which it was.
  return NextResponse.json(await runJob(job, "admin"));
}
