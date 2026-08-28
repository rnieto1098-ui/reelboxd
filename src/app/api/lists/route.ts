import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const createListSchema = z.object({
  title: z.string().min(1, "Give your list a name").max(100),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid list" },
      { status: 400 }
    );
  }

  const list = await prisma.list.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      ownerId: session.user.id,
    },
  });

  return NextResponse.json(list, { status: 201 });
}
