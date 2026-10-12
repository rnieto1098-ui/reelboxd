import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const orderSchema = z.object({
  order: z.array(z.string().min(1)).max(1000),
});

// Saves the signed-in user's display order for their own lists on the Lists
// tab. Ids are filtered against the lists they actually own, so a stale or
// tampered id can't be stored (same approach as curated-list-order).
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order" },
      { status: 400 }
    );
  }

  const owned = new Set(
    (
      await prisma.list.findMany({ where: { ownerId: session.user.id }, select: { id: true } })
    ).map((l) => l.id)
  );
  const cleaned = [...new Set(parsed.data.order)].filter((id) => owned.has(id));

  await prisma.user.update({
    where: { id: session.user.id },
    data: { listOrder: cleaned.join(",") },
  });

  return NextResponse.json({ ok: true });
}
