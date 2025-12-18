import { SelectOption } from "@/lib/types";
import { getAllAssigners, getAllIngredients, getDay, getDayForGuessing } from "../lib/dal";
import TeaGuessForm from "./TeaGuessForm";
import { canUserGuessPerson, canUserGuessTea } from "@/lib/services/tea-guess-service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Role, TeaType } from "@/generated/prisma/enums";
import { TEA_TYPE_LABELS } from "@/lib/utils";
import { BsFillPatchQuestionFill } from "react-icons/bs";
import { getAdvienteaDayState } from "@/lib/advientea-rules";
import { notFound } from "next/navigation";
import Link from "next/link";

interface TeaGuessCardProps {
  dayId: string;
}
export default async function TeaGuessCard({ dayId }: TeaGuessCardProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }

  const teaTypeOptions: SelectOption[] = Object.values(TeaType)
    .map((val) => ({
      id: val,
      name: TEA_TYPE_LABELS[val] ?? val,
    }))
    .toSorted((type1, type2) => type1.name.localeCompare(type2.name));

  const [ingredients, dayForGuessing, users] = await Promise.all([getAllIngredients(), getDayForGuessing(dayId), getAllAssigners()]);

  const ingredientList: Array<SelectOption> = ingredients?.map((ingredient) => ({ id: ingredient.id, name: ingredient.name })) ?? [];
  const teaHasIngredients: boolean = Array.isArray(dayForGuessing?.tea?.ingredients) && dayForGuessing.tea.ingredients.length > 0;
  const userList: Array<SelectOption> = users?.map((user) => ({ id: user.userId ?? "", name: user.user?.username ?? user.guestName ?? "" })).toSorted((user1, user2) => user1.name.localeCompare(user2.name)) ?? [];
  const canGuessTea = await canUserGuessTea(dayId, session.user.id);
  const canGuessPerson = await canUserGuessPerson(dayId, session.user.id);
  const day = await getDay(dayId);
  if (!day) {
    notFound();
  }
  const advienteaDayState = getAdvienteaDayState(day.dayNumber, day.year, session?.user.role as Role, false);
  const isAssignee = dayForGuessing?.assignment?.user?.id === session.user.id;

  return (
    <div className="card w-full max-w-xl bg-base-200 card-xl shadow-md border border-primary/20 mb-5">
      <div className="card-body items-center">
        <h2 className="card-title font-semibold gap-4 text-4xl items">
          <BsFillPatchQuestionFill />
          <div className="flex gap-0">Adivina<span className="italic">Té</span></div>
          <BsFillPatchQuestionFill />
        </h2>

        {isAssignee ? (
          <div className="text-center p-4">
            <div className="text-xl font-bold mb-2">¡Gracias por aportar tu granito de té!</div>
            <p className="text-md">Como eres le proponen<span className="italic">Té</span> de hoy, no puedes participar en el juego.</p>
          </div>
        ) : (
          <>
            <div className="font-[Griffy] text-lg">¡ Vamos a jugar !</div>
            <TeaGuessForm
              dayId={dayId}
              users={userList}
              teaHasIngredients={teaHasIngredients}
              ingredients={ingredientList}
              teaTypeOptions={teaTypeOptions}
              canUserGuessTea={canGuessTea}
              canUserGuessPerson={canGuessPerson}
            />
          </>
        )}
        {advienteaDayState.isTeaReleased && (
          <Link href={`/ranking/${dayId}`} className="mt-6">
            <button className="btn btn-success">Ranking de hoy</button>
          </Link>
        )}
      </div>
    </div>
  );
}
