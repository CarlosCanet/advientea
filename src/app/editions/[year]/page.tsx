import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import EnrolGuestForm from "@/components/ui/EnrolGuestForm";
import EnrolUserForm from "@/components/ui/EnrolUserForm";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { getDaysForEdition, getEdition, getParticipationsForEdition, getUsersBasic } from "@/lib/dal";
import { EditionIssue, findEditionIssues } from "@/lib/edition-issues";
import { toEditionYear } from "@/lib/schemas/edition";
import { EDITION_STATUS_LABELS, toParticipantName } from "@/lib/utils";

const DELETED_ACCOUNT = "Cuenta borrada";

const ISSUE_ORDER: Array<EditionIssue["kind"]> = [
  "teaWithoutOwner",
  "enrolledWithoutDay",
  "gap",
  "emptyDay",
  "participantWithoutTea",
];

const ISSUE_LABELS: Record<EditionIssue["kind"], string> = {
  emptyDay: "Días sin participante ni té",
  enrolledWithoutDay: "Inscritos sin día",
  gap: "Días que faltan",
  participantWithoutTea: "Participantes sin té",
  teaWithoutOwner: "Días con té y sin participante",
};

function toIssueItem(issue: EditionIssue): string {
  switch (issue.kind) {
    case "emptyDay":
    case "gap":
    case "teaWithoutOwner":
      return String(issue.dayNumber);
    case "enrolledWithoutDay":
      return issue.name ?? DELETED_ACCOUNT;
    case "participantWithoutTea":
      return `${issue.name ?? DELETED_ACCOUNT} (día ${issue.dayNumber})`;
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
  const [days, participations, users] = await Promise.all([
    getDaysForEdition(year),
    getParticipationsForEdition(year),
    getUsersBasic(),
  ]);

  const dayNumbersWithTea = new Set(days.filter((day) => day.tea !== null).map((day) => day.dayNumber));
  const issueLines = toIssueLines(
    findEditionIssues(
      days.map((day) => ({ dayNumber: day.dayNumber, hasTea: day.tea !== null })),
      participations.map((participation) => ({
        dayNumber: participation.day?.dayNumber ?? null,
        guestName: participation.guestName,
        id: participation.id,
        user: participation.user,
      })),
    ),
  );

  // Those with a day first, in calendar order; then those still without one, by name.
  const rows = participations
    .map((participation) => ({
      dayNumber: participation.day?.dayNumber ?? null,
      id: participation.id,
      isGuest: participation.userId === null && participation.guestName !== null,
      name: toParticipantName(participation) ?? DELETED_ACCOUNT,
    }))
    .sort((first, second) => {
      if (first.dayNumber !== null && second.dayNumber !== null) {
        return first.dayNumber - second.dayNumber;
      }
      if (first.dayNumber === null && second.dayNumber === null) {
        return first.name.localeCompare(second.name, "es");
      }
      return first.dayNumber === null ? 1 : -1;
    });

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
            <p>{days.length === 0 ? "La edición todavía no tiene días." : "No falta nada."}</p>
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
                    <th className="w-1">Día</th>
                    <th>Participante</th>
                    <th>Té</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="tabular-nums text-center">{row.dayNumber ?? "—"}</td>
                      <td>
                        {row.name}
                        {row.isGuest && <span className="badge badge-ghost badge-sm ml-2">Invitado</span>}
                      </td>
                      <td>
                        {row.dayNumber === null ? "—" : dayNumbersWithTea.has(row.dayNumber) ? "Subido" : "Falta"}
                      </td>
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
