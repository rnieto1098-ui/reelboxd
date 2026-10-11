import { NextResponse } from "next/server";

// A dated .csv download. Leading BOM so Excel reads the file as UTF-8 —
// without it, accented titles ("Amélie") open as mojibake. The importer
// strips it on the way back in.
export function csvDownloadResponse(csv: string, filenamePrefix: string): NextResponse {
  const filename = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
