import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGenreCounts } from "@/lib/challenges";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const counts = await getGenreCounts(session.user.id);
  return NextResponse.json({ counts });
}
