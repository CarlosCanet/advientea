import { ArrowLeft, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import DeleteDayButton from "@/components/editions/DeleteDayButton";
import EditionStatusBadge from "@/components/editions/EditionStatusBadge";
import EnrolGuestForm from "@/components/editions/EnrolGuestForm";
import EnrolUserForm from "@/components/editions/EnrolUserForm";
import GuestLinkButtons from "@/components/editions/GuestLinkButtons";
import ParticipantDaySelect, { CalendarDayOption } from "@/components/editions/ParticipantDaySelect";
import UnenrolParticipantButton from "@/components/editions/UnenrolParticipantButton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { canEditTea, getDaySchedule } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import {
  getDaysForEdition,
  getEdition,
  getEditionInfo,
  getParticipationsForEdition,
  getSession,
  getUsersBasic,
} from "@/lib/dal";
import { EditionIssue, findEditionIssues } from "@/lib/edition-issues";
import { toEditionYear } from "@/lib/schemas/edition";
import { toParticipantName } from "@/lib/utils";

const DELETED_ACCOUNT = "Cuenta borrada";

const SECTION_TITLE = "mb-3 text-lg font-semibold";
const TEXT_LINK = "rounded-sm underline underline-offset-4 focus-visible:focus-ring";

const ISSUE_ORDER: Array<EditionIssue["kind"]> = [
  "dayOutsideCalendar",
  "enrolledWithoutDay",
  "freeDay",
  "participantWithoutTea",
];

const ISSUE_LABELS: Record<EditionIssue["kind"], string> = {
  dayOutsideCalendar: "Días fuera del calendario",
  enrolledWithoutDay: "Inscritos sin día",
  freeDay: "Días libres",
  participantWithoutTea: "Participantes sin té",
};

function toIssueItem(issue: EditionIssue): string {
  switch (issue.kind) {
    case "dayOutsideCalendar":
    case "freeDay":
      return String(issue.dayNumber);
    case "enrolledWithoutDay":
      return issue.name ?? DELETED_ACCOUNT;
    case "participantWithoutTea": {
      const name = issue.name ?? DELETED_ACCOUNT;
      return issue.dayNumber === null ? name : `${name} (día ${issue.dayNumber})`;
    }
  }
}

/** One line per kind of issue: a calendar with twenty empty days reads as one warning, not twenty. */
function toIssueLines(issues: Array<EditionIssue>): Array<{ items: string; kind: EditionIssue["kind"] }> {
  return ISSUE_ORDER.map((kind) => ({
    items: issues
      .filter((issue) => issue.kind === kind)
      .map(toIssueItem)
      .join(", "),
    kind,
  })).filter((line) => line.items !== "");
}

export default async function EditionPage({ params }: { params: Promise<{ year: string }> }) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.EXECUTEAVE) {
    notFound();
  }
  const year = toEditionYear((await params).year);
  if (year === null) {
    notFound();
  }
  const edition = await getEdition(year);
  if (!edition) {
    notFound();
  }
  const [days, editionInfo, participations, users] = await Promise.all([
    getDaysForEdition(year),
    getEditionInfo(year),
    getParticipationsForEdition(year),
    getUsersBasic(),
  ]);
  const now = getNow();

  // A day that has opened or has guesses cannot change hands, and whoever holds it cannot be removed.
  const guessCounts = new Map(days.map((day) => [day.dayNumber, day._count.guesses]));
  const isDayLocked = (dayNumber: number) =>
    getDaySchedule(dayNumber, editionInfo, now).isReleased || (guessCounts.get(dayNumber) ?? 0) > 0;
  const acceptsEnrolments = edition.status !== EditionStatus.ARCHIVED;

  const issueLines = toIssueLines(
    findEditionIssues(
      days,
      participations.map((participation) => ({
        dayNumber: participation.day?.dayNumber ?? null,
        guestName: participation.guestName,
        hasTea: participation.tea !== null,
        id: participation.id,
        user: participation.user,
      })),
    ),
  );

  // Those with a day first, in calendar order; then those still without one, by name.
  const rows = participations
    .map((participation) => {
      const dayNumber = participation.day?.dayNumber ?? null;
      const isOwnDayLocked = dayNumber !== null && isDayLocked(dayNumber);
      const isGuest = participation.userId === null && participation.guestName !== null;
      return {
        canEditTea: canEditTea(session.user.role, {
          editionStatus: edition.status,
          isDayPlayed: isOwnDayLocked,
          isOwn: participation.userId === session.user.id,
        }),
        canUnenrol: acceptsEnrolments && !isOwnDayLocked,
        dayId: participation.day?.id ?? null,
        dayNumber,
        guestToken: isGuest && acceptsEnrolments ? participation.guestToken : null,
        // A guest's link opens their tea, so it is handed out only while that tea can still be saved.
        hasGuestLink: isGuest && acceptsEnrolments,
        id: participation.id,
        isGuest,
        isOwnDayLocked,
        name: toParticipantName(participation) ?? DELETED_ACCOUNT,
        tea: participation.tea,
      };
    })
    .sort((first, second) => {
      if (first.dayNumber !== null && second.dayNumber !== null) {
        return first.dayNumber - second.dayNumber;
      }
      if (first.dayNumber === null && second.dayNumber === null) {
        return first.name.localeCompare(second.name, "es");
      }
      return first.dayNumber === null ? 1 : -1;
    });

  // The calendar every day select offers: days 1..N, N being the number of participants, with who holds each.
  const holders = new Map<number, CalendarDayOption["holder"]>();
  for (const row of rows) {
    if (row.dayNumber !== null) {
      holders.set(row.dayNumber, { name: row.name, participationId: row.id });
    }
  }
  const calendarDays: Array<CalendarDayOption> = Array.from({ length: participations.length }, (_, index) => ({
    dayNumber: index + 1,
    holder: holders.get(index + 1) ?? null,
    isLocked: isDayLocked(index + 1),
  }));

  // Day rows that nobody holds. Only an admin deletes them, so nobody else is shown them.
  const unheldDays =
    session.user.role === Role.ADMIN
      ? days
          .filter((day) => !holders.has(day.dayNumber))
          .map((day) => ({
            dayNumber: day.dayNumber,
            guessCount: day._count.guesses,
            id: day.id,
            isOutsideCalendar: day.dayNumber > participations.length,
            isReleased: getDaySchedule(day.dayNumber, editionInfo, now).isReleased,
          }))
      : [];

  const enrolledUserIds = new Set(participations.map((participation) => participation.userId));
  const usersNotEnrolled = users.filter((user) => !enrolledUserIds.has(user.id));

  return (
    <div className="px-4 py-5">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="gap-3">
          <Link
            className={buttonVariants({ className: "justify-self-start", size: "sm", variant: "outline" })}
            href="/editions"
          >
            <ArrowLeft aria-hidden="true" />
            Ediciones
          </Link>
          <h1 className="text-center font-display text-2xl sm:text-3xl">{edition.name}</h1>
          <p className="flex flex-wrap items-center justify-center gap-2 text-sm">
            Edición {edition.year}
            <EditionStatusBadge status={edition.status} />
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-8">
          <section aria-labelledby="edition-issues">
            <h2 className={SECTION_TITLE} id="edition-issues">
              Avisos
            </h2>
            {issueLines.length === 0 ? (
              <p className="flex items-center gap-2 text-base">
                {participations.length === 0 ? (
                  "La edición todavía no tiene participantes."
                ) : (
                  <>
                    <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                    No falta nada.
                  </>
                )}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 rounded-xl bg-popover p-3 ring-1 ring-foreground/10">
                {issueLines.map((line) => (
                  <li className="flex gap-2 text-base" key={line.kind}>
                    <TriangleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{ISSUE_LABELS[line.kind]}:</span> {line.items}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="edition-participants">
            <h2 className={SECTION_TITLE} id="edition-participants">
              Participantes ({rows.length})
            </h2>
            {rows.length === 0 ? (
              <p className="text-base">Todavía no hay nadie inscrito.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1 px-1">Día</TableHead>
                    <TableHead>Participante</TableHead>
                    <TableHead>Té</TableHead>
                    <TableHead className="w-1 px-1">
                      <span className="sr-only">Ver el día</span>
                    </TableHead>
                    <TableHead className="w-1 px-1">
                      <span className="sr-only">Quitar</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="px-1">
                        <ParticipantDaySelect
                          dayNumber={row.dayNumber}
                          days={calendarDays}
                          isOwnDayLocked={row.isOwnDayLocked}
                          name={row.name}
                          participationId={row.id}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {row.name}
                          {row.isGuest && <Badge variant="secondary">Invitado</Badge>}
                        </div>
                        {row.hasGuestLink && (
                          <GuestLinkButtons name={row.name} participationId={row.id} token={row.guestToken} />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.tea === null ? (
                          "Falta"
                        ) : row.canEditTea ? (
                          <Link className={TEXT_LINK} href={`/edit-tea-info/${row.tea.id}`}>
                            {row.tea.name}
                          </Link>
                        ) : (
                          row.tea.name
                        )}
                      </TableCell>
                      <TableCell className="px-1">
                        {row.dayId !== null && (
                          <Link
                            aria-label={`Ver el día ${row.dayNumber}`}
                            className={buttonVariants({ size: "sm", variant: "link" })}
                            href={`/teaDay/${row.dayId}?simulated=true`}
                          >
                            Ver
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="px-1">
                        {row.canUnenrol && (
                          <UnenrolParticipantButton
                            name={row.name}
                            participationId={row.id}
                            teaName={row.tea?.name ?? null}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {unheldDays.length > 0 && (
            <section aria-labelledby="edition-unheld-days">
              <h2 className={SECTION_TITLE} id="edition-unheld-days">
                Días sin nadie
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Filas de días que no tiene nadie. Borrarlas no cambia el calendario, que va del 1 al número de
                participantes.
              </p>
              <ul className="flex flex-col gap-2">
                {unheldDays.map((day) => (
                  <li className="flex items-center justify-between gap-2" key={day.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{`Día ${day.dayNumber}`}</span>
                      {day.isOutsideCalendar && (
                        <Badge variant="outline">
                          <TriangleAlert aria-hidden="true" />
                          Fuera del calendario
                        </Badge>
                      )}
                      {day.isReleased && <Badge variant="secondary">Abierto</Badge>}
                      {day.guessCount > 0 && (
                        <Badge variant="secondary">
                          {day.guessCount === 1 ? "1 apuesta" : `${day.guessCount} apuestas`}
                        </Badge>
                      )}
                    </div>
                    <DeleteDayButton
                      dayId={day.id}
                      dayNumber={day.dayNumber}
                      guessCount={day.guessCount}
                      isReleased={day.isReleased}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="edition-enrol">
            <h2 className={SECTION_TITLE} id="edition-enrol">
              Inscribir
            </h2>
            {acceptsEnrolments ? (
              <div className="flex flex-col gap-5">
                <EnrolUserForm users={usersNotEnrolled} year={year} />
                <EnrolGuestForm year={year} />
              </div>
            ) : (
              <p className="text-base">La edición está archivada y ya no admite inscripciones.</p>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
