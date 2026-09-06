import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteChallenge, renameChallenge } from "@/lib/challenges";

const renameSchema = z.object({ title: z.string().trim().min(1).max(100) });

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid title" },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const renamed = await renameChallenge(session.user.id, id, parsed.data.title);
  if (!renamed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
