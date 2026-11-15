import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createChallenge, generateRandomChallenge } from "@/lib/challenges";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const input = await generateRandomChallenge(session.user.id);
  if (!input) {
    // Nothing new to suggest: every idea it could come up with is already
    // one of this user's challenges.
    return NextResponse.json(
      {
        error:
          "No new ideas right now. Log a few more films, or build a challenge of your own.",
      },
      { status: 409 }
    );
  }
  const challenge = await createChallenge(session.user.id, input);
  return NextResponse.json(challenge, { status: 201 });
}
