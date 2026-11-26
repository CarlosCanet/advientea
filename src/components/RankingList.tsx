import { cn } from "cn";
import { Trophy } from "lucide-react";

import ProfileImage from "@/components/profile/ProfileImage";
import RankingPositionBar from "@/components/ranking/RankingPositionBar";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemMedia } from "@/components/ui/item";
import { toRankingView } from "@/lib/ranking-view";
import { RankingEntry } from "@/lib/types";

interface RankingListProps {
  currentUserId: string;
  ranking: Array<RankingEntry>;
}

const CURRENT_USER_ANCHOR = "tu-posicion";

/** Podium places by their index in the podium: the first stands in the middle and tallest. */
const PODIUM_PLACES = [
  { avatar: "size-16", column: "col-start-2", step: "h-20 text-4xl", surface: "bg-honey text-honey-foreground" },
  { avatar: "size-12", column: "col-start-1", step: "h-14 text-3xl", surface: "bg-card text-card-foreground" },
  { avatar: "size-12", column: "col-start-3", step: "h-10 text-2xl", surface: "bg-card text-card-foreground" },
];

function toPointsLabel(points: number): string {
  return points < 0 ? "Próximamente" : `${points} puntos`;
}

export default function RankingList({ currentUserId, ranking }: RankingListProps) {
  if (ranking.length === 0) {
    return (
      <Empty className="rounded-2xl bg-card p-8 text-card-foreground shadow-sm">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trophy />
          </EmptyMedia>
          <EmptyTitle className="text-base">Nadie ha jugado todavía.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const { currentUser, isCurrentUserOnPodium, podium, rest } = toRankingView(ranking, currentUserId);

  return (
    <div className="flex flex-col gap-4">
      {/* `role="list"`: Safari drops list semantics once `list-style` is none. */}
      <ol aria-label="Clasificación" className="grid grid-cols-3 items-end gap-2 sm:gap-3" role="list">
        {podium.map((entry, index) => {
          const place = PODIUM_PLACES[index];
          const isCurrentUser = entry.userId === currentUserId;
          return (
            <li
              className={cn(
                "row-start-1 flex min-w-0 flex-col items-center rounded-t-2xl rounded-b-md px-1.5 pt-4 text-center shadow-sm",
                place.column,
                place.surface,
              )}
              key={entry.userId}
            >
              <span className="sr-only">{`Puesto ${entry.rank}: `}</span>
              <div className="relative">
                <ProfileImage className={place.avatar} image={entry.avatar} isDecorative name={entry.username} />
                {isCurrentUser && <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-sm">Tú</Badge>}
              </div>
              <p className="mt-3 line-clamp-2 w-full text-sm font-semibold break-words sm:text-base">
                {entry.username}
              </p>
              <p className="text-xs font-medium tabular-nums sm:text-sm">{toPointsLabel(entry.points)}</p>
              <p aria-hidden="true" className={cn("flex items-center font-bold tabular-nums", place.step)}>
                {entry.rank}º
              </p>
            </li>
          );
        })}

        {rest.map((entry, index) => {
          const isCurrentUser = entry.userId === currentUserId;
          const pointsLabel = toPointsLabel(entry.points);
          return (
            <Item
              className={cn(
                "col-span-3 scroll-mt-20 scroll-mb-24 flex-nowrap bg-card text-card-foreground shadow-sm",
                index === 0 && "mt-2",
                isCurrentUser && "border-foreground bg-popover",
              )}
              id={isCurrentUser ? CURRENT_USER_ANCHOR : undefined}
              key={entry.userId}
              render={<li />}
              size="sm"
              tabIndex={isCurrentUser ? -1 : undefined}
            >
              <span className="w-9 shrink-0 text-right text-lg font-semibold tabular-nums">
                <span className="sr-only">Puesto </span>
                {entry.rank}º
              </span>
              <ItemMedia>
                <ProfileImage className="size-10" image={entry.avatar} isDecorative name={entry.username} />
              </ItemMedia>
              <ItemContent className="min-w-0 gap-0.5">
                <span className="text-base font-semibold break-words">{entry.username}</span>
                {/* On phones the points go under the name, so a long name keeps the row's width. */}
                <span
                  className={cn(
                    "flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums",
                    !isCurrentUser && "sm:hidden",
                  )}
                >
                  <span className="sm:hidden">{pointsLabel}</span>
                  {isCurrentUser && <Badge>Tú</Badge>}
                </span>
              </ItemContent>
              <ItemActions className="hidden shrink-0 text-sm font-semibold tabular-nums sm:flex">
                {pointsLabel}
              </ItemActions>
            </Item>
          );
        })}
      </ol>

      {currentUser && !isCurrentUserOnPodium && (
        <RankingPositionBar
          label={`Tu posición: ${currentUser.rank}º · ${toPointsLabel(currentUser.points)}`}
          targetId={CURRENT_USER_ANCHOR}
        />
      )}
    </div>
  );
}
