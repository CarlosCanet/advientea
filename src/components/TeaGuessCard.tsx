import { cn } from "cn";
import { BadgeQuestionMark, LogIn, Trophy, UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TeaType } from "@/generated/prisma/enums";
import { getAdvienteaDayState, getDaySchedule } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import { getAllIngredients, getAssignees, getDayById, getDayForGuessing, getEditionInfo, getSession } from "@/lib/dal";
import { getGuessCardState } from "@/lib/day-view";
import { canUserGuessPerson, canUserGuessTea } from "@/lib/services/tea-guess-service";
import { SelectOption } from "@/lib/types";
import { TEA_TYPE_LABELS, toParticipantName } from "@/lib/utils";

import TeaGuessForm from "./TeaGuessForm";

interface TeaGuessCardProps {
  dayId: string;
}
function GuessCardHeading() {
  return (
    <h2 className="flex items-center gap-3">
      <BadgeQuestionMark aria-hidden="true" className="size-7" />
      <span className="font-display text-3xl">
        Adivina<span className="italic">Té</span>
      </span>
      <BadgeQuestionMark aria-hidden="true" className="size-7" />
    </h2>
  );
}

export default async function TeaGuessCard({ dayId }: TeaGuessCardProps) {
  const session = await getSession();
  const day = await getDayById(dayId);
  if (!day) {
    notFound();
  }
  const editionInfo = await getEditionInfo(day.year);
  if (!session) {
    // The raw schedule, because the anonymous view hides names and would close the card while users still guess the author.
    const schedule = getDaySchedule(day.dayNumber, editionInfo, getNow());
    const isGuessingOver = schedule.isTeaReleased && schedule.isPersonNameReleased;
    return (
      <Card className="w-full items-center gap-5 px-5 shadow-sm">
        <GuessCardHeading />
        <p className="text-center text-lg font-medium">
          {isGuessingOver ? "Las apuestas de este día están cerradas." : "Entra para jugar"}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link className={buttonVariants()} href="/sign-in">
            <LogIn data-icon="inline-start" />
            Entrar
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/sign-up">
            <UserPlus data-icon="inline-start" />
            Crear cuenta
          </Link>
        </div>
      </Card>
    );
  }

  const teaTypeOptions: SelectOption[] = Object.values(TeaType)
    .map((val) => ({
      id: val,
      name: TEA_TYPE_LABELS[val] ?? val,
    }))
    .toSorted((type1, type2) => type1.name.localeCompare(type2.name));

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
  const advienteaDayState = getAdvienteaDayState(day.dayNumber, editionInfo, session.user.role, false);
  const isAssignee = dayForGuessing?.participation?.user?.id === session.user.id;
  const cardState = getGuessCardState({
    canGuessPerson,
    canGuessTea,
    hasTea: Boolean(dayForGuessing?.participation?.tea),
    isAssignee,
    isSignedIn: true,
  });
  if (cardState === "noTea") {
    return null;
  }

  return (
    <Card className="w-full items-center gap-5 px-5 shadow-sm">
      <GuessCardHeading />

      {cardState === "assignee" && (
        <div className="text-center">
          <p className="mb-2 text-lg font-semibold">¡Gracias por aportar tu granito de té!</p>
          <p className="text-base">Hoy el té lo propones tú, así que no juegas.</p>
        </div>
      )}
      {cardState === "open" && <p className="text-lg font-medium">¡Vamos a jugar!</p>}
      {cardState === "authorOnly" && (
        <p className="text-center text-base">El té ya se ha desvelado. Aún puedes adivinar quién lo propone.</p>
      )}
      {cardState === "closed" && <p className="text-lg font-medium">Apuestas cerradas</p>}
      {(cardState === "open" || cardState === "authorOnly") && (
        <TeaGuessForm
          canUserGuessPerson={canGuessPerson}
          canUserGuessTea={canGuessTea}
          dayId={dayId}
          ingredients={ingredientList}
          teaHasIngredients={teaHasIngredients}
          teaTypeOptions={teaTypeOptions}
          users={userList}
        />
      )}
      {advienteaDayState.isTeaReleased && (
        <Link
          className={cn(
            buttonVariants({ variant: cardState === "closed" ? "default" : "outline" }),
            cardState !== "closed" && "mt-2",
          )}
          href={`/ranking/${dayId}`}
        >
          <Trophy data-icon="inline-start" />
          Ranking de hoy
        </Link>
      )}
    </Card>
  );
}
