import { BadgeQuestionMark, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TeaType } from "@/generated/prisma/enums";
import { getAdvienteaDayState } from "@/lib/advientea-rules";
import { getAllIngredients, getAssignees, getDayById, getDayForGuessing, getEditionInfo, getSession } from "@/lib/dal";
import { canUserGuessPerson, canUserGuessTea } from "@/lib/services/tea-guess-service";
import { SelectOption } from "@/lib/types";
import { TEA_TYPE_LABELS, toParticipantName } from "@/lib/utils";

import TeaGuessForm from "./TeaGuessForm";

interface TeaGuessCardProps {
  dayId: string;
}
export default async function TeaGuessCard({ dayId }: TeaGuessCardProps) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const teaTypeOptions: SelectOption[] = Object.values(TeaType)
    .map((val) => ({
      id: val,
      name: TEA_TYPE_LABELS[val] ?? val,
    }))
    .toSorted((type1, type2) => type1.name.localeCompare(type2.name));

  const day = await getDayById(dayId);
  if (!day) {
    notFound();
  }

  const [ingredients, dayForGuessing, users] = await Promise.all([
    getAllIngredients(),
    getDayForGuessing(dayId),
    getAssignees(day.year),
  ]);

  const ingredientList: Array<SelectOption> =
    ingredients?.map((ingredient) => ({ id: ingredient.id, name: ingredient.name })) ?? [];
  const teaHasIngredients: boolean = (dayForGuessing?.participation?.tea?.ingredients.length ?? 0) > 0;
  const userList: Array<SelectOption> = users
    .map((user) => ({ id: user.userId ?? "", name: toParticipantName(user) ?? "" }))
    .toSorted((user1, user2) => user1.name.localeCompare(user2.name));
  const canGuessTea = await canUserGuessTea(dayId, session.user.id);
  const canGuessPerson = await canUserGuessPerson(dayId, session.user.id);
  const advienteaDayState = getAdvienteaDayState(
    day.dayNumber,
    await getEditionInfo(day.year),
    session.user.role,
    false,
  );
  const isAssignee = dayForGuessing?.participation?.user?.id === session.user.id;

  return (
    <Card className="w-full items-center gap-5 px-5 shadow-sm">
      <h2 className="flex items-center gap-3">
        <BadgeQuestionMark aria-hidden="true" className="size-7" />
        <span className="font-display text-3xl">
          Adivina<span className="italic">Té</span>
        </span>
        <BadgeQuestionMark aria-hidden="true" className="size-7" />
      </h2>

      {isAssignee ? (
        <div className="text-center">
          <p className="mb-2 text-lg font-semibold">¡Gracias por aportar tu granito de té!</p>
          <p className="text-base">
            Como eres le proponen<span className="italic">Té</span> de hoy, no puedes participar en el juego.
          </p>
        </div>
      ) : (
        <>
          <p className="text-lg font-medium">¡ Vamos a jugar !</p>
          <TeaGuessForm
            canUserGuessPerson={canGuessPerson}
            canUserGuessTea={canGuessTea}
            dayId={dayId}
            ingredients={ingredientList}
            teaHasIngredients={teaHasIngredients}
            teaTypeOptions={teaTypeOptions}
            users={userList}
          />
        </>
      )}
      {advienteaDayState.isTeaReleased && (
        <Link className={buttonVariants({ className: "mt-2", variant: "outline" })} href={`/ranking/${dayId}`}>
          <Trophy data-icon="inline-start" />
          Ranking de hoy
        </Link>
      )}
    </Card>
  );
}
