import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportWatchlistCsv } from "@/lib/exportData";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const csv = await exportWatchlistCsv(session.user.id);
  const filename = `flixtally-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;

  // Leading BOM so Excel reads the file as UTF-8 — without it, accented
  // titles ("Amélie") open as mojibake. The watchlist importer strips it.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
