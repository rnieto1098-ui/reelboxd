import { userFacingError } from "@/lib/userFacingError";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { importLetterboxdZip } from "@/lib/letterboxdImport";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json(
      { error: "Please upload the .zip file Letterboxd gives you" },
      { status: 400 }
    );
  }

  try {
    const buffer = await file.arrayBuffer();
    const summary = await importLetterboxdZip(session.user.id, buffer);
    return NextResponse.json(summary);
  } catch (err) {
    const message = userFacingError(err, "The import failed part-way. Anything already imported is saved; try the file again.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
