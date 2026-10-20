import { RankingEntry } from "@/lib/types";

import ProfileImage from "./ui/ProfileImage";

interface RankingListProps {
  currentUserId: string;
  ranking: Array<RankingEntry>;
}

export default function RankingList({ currentUserId, ranking }: RankingListProps) {
  if (ranking.length === 0) {
    return (
      <div className="card w-full max-w-xl bg-base-200 card-xl shadow-md border border-primary/20 mb-5">
        <div className="text-center p-8 font-[Griffy] text-lg">No hay resultados para hoy...</div>
      </div>
    );
  }
  return (
    <div className="card w-full max-w-xl bg-base-200 card-xl shadow-md border border-primary/20 mb-5">
      <ul className="list bg-base-100 rounded-box shadow-md">
        {ranking.map((user) => {
          const isCurrentUser = user.userId === currentUserId;
          return (
            <li
              className={`list-row items-center ${isCurrentUser && "bg-secondary/65 text-secondary-content/65"}`}
              key={user.userId}
            >
              <div className="text-4xl font-medium opacity-40 tabular-nums">
                {user.rank.toString().padStart(2, "0")}
              </div>
              <div>
                <ProfileImage image={user.avatar} name={user.username} />
              </div>
              <div className="list-col-grow">
                <div className="font-semibold opacity-75">{user.username}</div>
              </div>
              <div className="text-xs uppercase font-bold opacity-80">
                {user.points < 0 ? "Próximamente" : `${user.points} puntos`}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
