import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteChallenge } from "@/lib/challenges";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await context.params;
  await deleteChallenge(session.user.id, id);
  return NextResponse.json({ ok: true });
}
