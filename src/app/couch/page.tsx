import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { CouchScene } from "@/components/couch/CouchScene";
import { CouchTv } from "@/components/couch/CouchTv";
import { getCouchData, hasStreamingServices } from "@/lib/couch/data";

export const metadata: Metadata = {
  title: "Couch",
  description: "Sit back, pick an app, pick a film.",
};

function TvMessage({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="animate-tv-on flex h-full flex-col items-center justify-center gap-[0.8em] bg-[radial-gradient(100%_80%_at_50%_0%,#18233d_0%,#06080d_65%)] p-[2em] text-center text-white [font-size:max(10px,2.1cqw)]">
      <p className="font-[family-name:var(--font-display)] text-[1.7em] font-bold leading-tight">{title}</p>
      <p className="max-w-[34em] text-[0.9em] text-white/70">{body}</p>
      {action}
    </div>
  );
}

function TvBooting() {
  return (
    <div className="flex h-full items-center justify-center bg-[#06080d] text-white/60 [font-size:max(10px,2.1cqw)]">
      <span className="animate-pulse text-[0.9em]">Switching on…</span>
    </div>
  );
}

async function SignedInTv({ userId, username }: { userId: string; username: string }) {
  if (!(await hasStreamingServices(userId))) {
    return (
      <TvMessage
        title="No apps installed yet"
        body="Tell Flixtally which streaming services you have and they'll appear here as apps."
        action={
          <Link href="/streaming" className="btn btn-primary">
            Add my services
          </Link>
        }
      />
    );
  }
  const data = await getCouchData(userId);
  return <CouchTv data={data} username={username} />;
}

export default async function CouchPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <>
      <h1 className="sr-only">Couch</h1>
      <CouchScene
        footer={
          <p className="pointer-events-none absolute inset-x-0 bottom-[3%] hidden text-center text-xs text-white/55 pointer-fine:block">
            Use the arrow keys like a remote · Enter to choose · Esc to go back
          </p>
        }
      >
        {user?.id && user.name ? (
          <Suspense fallback={<TvBooting />}>
            <SignedInTv userId={user.id} username={user.name} />
          </Suspense>
        ) : (
          <TvMessage
            title="Grab the remote"
            body="Sign in and your streaming services show up here as apps, filled with films picked for you."
            action={
              <Link href="/login?next=/couch" className="btn btn-primary">
                Sign in
              </Link>
            }
          />
        )}
      </CouchScene>
    </>
  );
}
