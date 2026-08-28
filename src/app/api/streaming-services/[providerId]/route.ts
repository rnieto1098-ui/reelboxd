import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  providerName: z.string().min(1),
  logoPath: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ providerId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { providerId } = await context.params;
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const service = await prisma.streamingService.upsert({
    where: {
      userId_providerId: { userId: session.user.id, providerId: Number(providerId) },
    },
    update: {},
    create: {
      userId: session.user.id,
      providerId: Number(providerId),
      providerName: parsed.data.providerName,
      logoPath: parsed.data.logoPath ?? null,
    },
  });

  return NextResponse.json(service);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ providerId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { providerId } = await context.params;

  await prisma.streamingService
    .delete({
      where: {
        userId_providerId: { userId: session.user.id, providerId: Number(providerId) },
      },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
