import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import EnrolGuestForm from "@/components/ui/EnrolGuestForm";
import EnrolUserForm from "@/components/ui/EnrolUserForm";
import ParticipantDaySelect, { CalendarDayOption } from "@/components/ui/ParticipantDaySelect";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { getDaySchedule } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import { auth } from "@/lib/auth";
import { getDaysForEdition, getEdition, getEditionInfo, getParticipationsForEdition, getUsersBasic } from "@/lib/dal";
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
  const session = await auth.api.getSession({ headers: await headers() });
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
      return {
        dayNumber,
        hasTea: participation.tea !== null,
        id: participation.id,
        isGuest: participation.userId === null && participation.guestName !== null,
        isOwnDayReleased: dayNumber !== null && getDaySchedule(dayNumber, editionInfo, now).isReleased,
        name: toParticipantName(participation) ?? DELETED_ACCOUNT,
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
    isReleased: getDaySchedule(index + 1, editionInfo, now).isReleased,
  }));

  const enrolledUserIds = new Set(participations.map((participation) => participation.userId));
  const usersNotEnrolled = users.filter((user) => !enrolledUserIds.has(user.id));
  const acceptsEnrolments = edition.status !== EditionStatus.ARCHIVED;

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
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-1">
                        <ParticipantDaySelect
                          dayNumber={row.dayNumber}
                          days={calendarDays}
                          isOwnDayReleased={row.isOwnDayReleased}
                          name={row.name}
                          participationId={row.id}
                        />
                      </td>
                      <td>
                        {row.name}
                        {row.isGuest && <span className="badge badge-ghost badge-sm ml-2">Invitado</span>}
                      </td>
                      <td>{row.hasTea ? "Subido" : "Falta"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
