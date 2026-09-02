import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTimeframePreviewCount } from "@/lib/challenges";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const startParam = params.get("start");
  const endParam = params.get("end");
  if (!startParam || !endParam) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }

  const startDate = new Date(`${startParam}T00:00:00.000Z`);
  const endDate = new Date(`${endParam}T23:59:59.999Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const count = await getTimeframePreviewCount(session.user.id, startDate, endDate);
  return NextResponse.json({ count });
}
