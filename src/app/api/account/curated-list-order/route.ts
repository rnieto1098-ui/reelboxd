import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { setCuratedListOrder } from "@/lib/systemLists";

const orderSchema = z.object({
  order: z.array(z.string().min(1)).max(100),
});

// Saves the signed-in user's drag/click-reordered display order for the
// homepage's "Your List Progress" cards. See setCuratedListOrder for the
// validation that keeps this from becoming a place to stash arbitrary data.
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order" },
      { status: 400 }
    );
  }

  await setCuratedListOrder(session.user.id, parsed.data.order);

  return NextResponse.json({ ok: true });
}
