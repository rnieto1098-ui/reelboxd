import {
  CalendarRange,
  Check,
  Clapperboard,
  Drama,
  ListChecks,
  Popcorn,
  type LucideIcon,
} from "lucide-react";
import type { ChallengeSummary } from "@/lib/challenges";
import { challengeStatus } from "@/lib/challengeStatus";
import { formatTimeLeft } from "@/lib/dates";
import { ProgressBar, ProgressRing } from "@/components/Progress";
import { EditableTitle } from "@/components/EditableTitle";
import { DeleteChallengeButton } from "@/components/DeleteChallengeButton";

const TYPE: Record<ChallengeSummary["type"], { label: string; icon: LucideIcon }> = {
  GENRE: { label: "Genre", icon: Drama },
  TIMEFRAME: { label: "Date range", icon: CalendarRange },
  CREW: { label: "Filmography", icon: Clapperboard },
  LIST: { label: "List", icon: ListChecks },
  CUSTOM: { label: "Hand-picked", icon: Popcorn },
};

/**
 * One challenge: what it is, how far along it is, and (for its owner) the
 * controls to rename or remove it. Shared by the Challenges tab and public
 * profiles, which pass `canEdit={false}`.
 *
 * Completed challenges look completed (green border, a tick in the ring)
 * rather than just changing a line of text, and a date-range challenge whose
 * window closed says how it ended.
 */
export function ChallengeCard({
  challenge,
  canEdit,
}: {
  challenge: ChallengeSummary;
  canEdit: boolean;
}) {
  const status = challengeStatus(challenge);
  const { label, icon: TypeIcon } = TYPE[challenge.type];
  const href = `/challenges/${challenge.id}`;

  const progressLine =
    challenge.target != null && challenge.target > 0
      ? `${challenge.count} of ${challenge.target} film${challenge.target === 1 ? "" : "s"}`
      : `${challenge.count} film${challenge.count === 1 ? "" : "s"} so far`;

  return (
    <article
      className={`card relative flex flex-col p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 ${
        status === "complete"
          ? "border-accent-green/45 bg-gradient-to-br from-accent-green-soft to-surface"
          : status === "ended"
            ? "opacity-80 hover:border-border-strong"
            : "hover:border-border-strong"
      }`}
    >
      <div className="flex items-start gap-4">
        <ProgressRing percent={challenge.percent}>
          {status === "complete" ? <Check className="h-5 w-5" strokeWidth={3} /> : undefined}
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
            <TypeIcon aria-hidden className="h-3.5 w-3.5" />
            {label}
            {status === "complete" && (
              <span className="ml-1 rounded-full bg-accent-green px-1.5 py-px text-[10px] tracking-normal text-black">
                Complete
              </span>
            )}
            {status === "ended" && (
              <span className="ml-1 rounded-full bg-white/10 px-1.5 py-px text-[10px] tracking-normal text-muted">
                Ended
              </span>
            )}
          </p>
          <EditableTitle
            endpoint={`/api/challenges/${challenge.id}`}
            title={challenge.title}
            href={href}
            canEdit={canEdit}
            className="text-[15px] font-semibold leading-snug"
            twoLines
          />
        </div>

        {canEdit && <DeleteChallengeButton challengeId={challenge.id} />}
      </div>

      <div className="mt-4">
        <ProgressBar percent={challenge.percent} label={`${challenge.title} progress`} />
      </div>
      <p className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted">
        <span>{progressLine}</span>
        {challenge.type === "TIMEFRAME" && challenge.endDate && status === "active" && (
          <span>{formatTimeLeft(challenge.endDate)}</span>
        )}
        {status === "ended" && challenge.target != null && (
          <span>Finished {challenge.target - challenge.count} short</span>
        )}
      </p>
    </article>
  );
}
