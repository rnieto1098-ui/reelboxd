import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createChallenge, generateRandomChallenge } from "@/lib/challenges";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const input = await generateRandomChallenge(session.user.id);
  const challenge = await createChallenge(session.user.id, input);
  return NextResponse.json(challenge, { status: 201 });
}
