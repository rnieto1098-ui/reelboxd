import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportUserDataZip } from "@/lib/exportData";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const zipBuffer = await exportUserDataZip(session.user.id);
  const filename = `reelboxd-export-${new Date().toISOString().slice(0, 10)}.zip`;

  // NextResponse's BodyInit type doesn't accept a Node Buffer directly
  // (even though Buffer is a Uint8Array at runtime) — wrap it.
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
