import { RankingEntry } from "@/lib/types";
import ProfileImage from "./ui/ProfileImage";

interface RankingListProps {
  ranking: Array<RankingEntry>;
  currentUserId: string;
}

export default function RankingList({ ranking, currentUserId }: RankingListProps) {
  if (ranking.length === 0) {
    return <div className="text-center p-8">No hay resultados para hoy</div>;
  }
  return (
    <div className="card w-full max-w-xl bg-base-200 card-xl shadow-md border border-primary/20 mb-5">
      <ul className="list bg-base-100 rounded-box shadow-md">
        {ranking.map((user) => {
          const isCurrentUser = user.userId === currentUserId;
          return (
            <li key={user.userId} className={`list-row items-center ${isCurrentUser && "bg-secondary/65 text-secondary-content/65"}`}>
              <div className="text-4xl font-medium opacity-40 tabular-nums">{user.rank.toString().padStart(2, "0")}</div>
              <div>
                <ProfileImage image={user.avatar} name={user.username} />
              </div>
              <div className="list-col-grow">
                <div className="font-semibold opacity-75">{user.username}</div>
              </div>
              <div className="text-xs uppercase font-bold opacity-80">{user.points < 0 ? "Próximamente" : `${user.points} puntos`}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
