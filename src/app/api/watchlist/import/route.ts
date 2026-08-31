import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { importWatchlistFile } from "@/lib/letterboxdImport";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const summary = await importWatchlistFile(session.user.id, file);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
