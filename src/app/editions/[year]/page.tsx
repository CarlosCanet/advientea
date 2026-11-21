import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import DeleteDayButton from "@/components/editions/DeleteDayButton";
import EnrolGuestForm from "@/components/editions/EnrolGuestForm";
import EnrolUserForm from "@/components/editions/EnrolUserForm";
import GuestLinkButtons from "@/components/editions/GuestLinkButtons";
import ParticipantDaySelect, { CalendarDayOption } from "@/components/editions/ParticipantDaySelect";
import UnenrolParticipantButton from "@/components/editions/UnenrolParticipantButton";
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
import { EDITION_STATUS_LABELS, toParticipantName } from "@/lib/utils";

const DELETED_ACCOUNT = "Cuenta borrada";

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
    <div className="flex justify-center">
      <div className="card w-100 lg:w-180 m-5 bg-base-100 shadow-xl p-5 flex flex-col gap-6">
        <div>
          <Link className="link text-sm" href="/editions">
            ← Ediciones
          </Link>
          <h1 className="text-center text-xl font-bold tracking-tight md:text-3xl">{edition.name}</h1>
          <p className="text-center text-sm">
            Edición {edition.year} · {EDITION_STATUS_LABELS[edition.status]}
          </p>
        </div>

        <section aria-labelledby="edition-issues">
          <h2 className="text-lg font-bold mb-2" id="edition-issues">
            Avisos
          </h2>
          {issueLines.length === 0 ? (
            <p>{participations.length === 0 ? "La edición todavía no tiene participantes." : "No falta nada."}</p>
          ) : (
            <ul className="list-disc pl-5">
              {issueLines.map((line) => (
                <li key={line.kind}>
                  <span className="font-semibold">{ISSUE_LABELS[line.kind]}:</span> {line.items}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="edition-participants">
          <h2 className="text-lg font-bold mb-2" id="edition-participants">
            Participantes ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <p>Todavía no hay nadie inscrito.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-1 px-1">Día</th>
                    <th>Participante</th>
                    <th>Té</th>
                    <th className="w-1 px-1">
                      <span className="sr-only">Ver el día</span>
                    </th>
                    <th className="w-1 px-1">
                      <span className="sr-only">Quitar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-1">
                        <ParticipantDaySelect
                          dayNumber={row.dayNumber}
                          days={calendarDays}
                          isOwnDayLocked={row.isOwnDayLocked}
                          name={row.name}
                          participationId={row.id}
                        />
                      </td>
                      <td>
                        {row.name}
                        {row.isGuest && <span className="badge badge-ghost badge-sm ml-2">Invitado</span>}
                        {row.hasGuestLink && (
                          <GuestLinkButtons name={row.name} participationId={row.id} token={row.guestToken} />
                        )}
                      </td>
                      <td>
                        {row.tea === null ? (
                          "Falta"
                        ) : row.canEditTea ? (
                          <Link className="link" href={`/edit-tea-info/${row.tea.id}`}>
                            {row.tea.name}
                          </Link>
                        ) : (
                          row.tea.name
                        )}
                      </td>
                      <td className="px-1">
                        {row.dayId !== null && (
                          <Link
                            aria-label={`Ver el día ${row.dayNumber}`}
                            className="link"
                            href={`/teaDay/${row.dayId}?simulated=true`}
                          >
                            Ver
                          </Link>
                        )}
                      </td>
                      <td className="px-1">
                        {row.canUnenrol && (
                          <UnenrolParticipantButton
                            name={row.name}
                            participationId={row.id}
                            teaName={row.tea?.name ?? null}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {unheldDays.length > 0 && (
          <section aria-labelledby="edition-unheld-days">
            <h2 className="text-lg font-bold mb-2" id="edition-unheld-days">
              Días sin nadie
            </h2>
            <p className="text-sm mb-2">
              Filas de días que no tiene nadie. Borrarlas no cambia el calendario, que va del 1 al número de
              participantes.
            </p>
            <ul className="flex flex-col gap-2">
              {unheldDays.map((day) => (
                <li className="flex items-center justify-between gap-2" key={day.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{`Día ${day.dayNumber}`}</span>
                    {day.isOutsideCalendar && (
                      <span className="badge badge-warning badge-sm">Fuera del calendario</span>
                    )}
                    {day.isReleased && <span className="badge badge-ghost badge-sm">Abierto</span>}
                    {day.guessCount > 0 && (
                      <span className="badge badge-ghost badge-sm">
                        {day.guessCount === 1 ? "1 apuesta" : `${day.guessCount} apuestas`}
                      </span>
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
          <h2 className="text-lg font-bold mb-2" id="edition-enrol">
            Inscribir
          </h2>
          {acceptsEnrolments ? (
            <div className="flex flex-col gap-4">
              <EnrolUserForm users={usersNotEnrolled} year={year} />
              <EnrolGuestForm year={year} />
            </div>
          ) : (
            <p>La edición está archivada y ya no admite inscripciones.</p>
          )}
        </section>
      </div>
    </div>
  );
}
