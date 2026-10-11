import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportWatchlistCsv } from "@/lib/exportData";
import { csvDownloadResponse } from "@/lib/csvResponse";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return csvDownloadResponse(await exportWatchlistCsv(session.user.id), "flixtally-watchlist");
}
