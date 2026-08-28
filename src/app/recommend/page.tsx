import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RecommendForm } from "@/components/RecommendForm";

export default async function RecommendPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">What should I watch?</h1>
      <p className="mb-6 text-sm text-muted">
        Describe the vibe you&apos;re after — mood, genre, a movie it should feel like, how long
        you&apos;ve got, how well-reviewed it should be. We&apos;ll pick a handful of popular
        movies you haven&apos;t seen yet.
      </p>

      <RecommendForm />
    </div>
  );
}
