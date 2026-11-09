import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import CreateEditionDialog from "@/components/CreateEditionDialog";
import DeleteEditionButton from "@/components/ui/DeleteEditionButton";
import EditionStatusSelect from "@/components/ui/EditionStatusSelect";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { getNow, toMadridDateTime } from "@/lib/advientea-time";
import { auth } from "@/lib/auth";
import { getAllEditions } from "@/lib/dal";
import { EDITION_STATUS_LABELS } from "@/lib/utils";

const STATUS_BADGES: Record<EditionStatus, string> = {
  [EditionStatus.ACTIVE]: "badge-success",
  [EditionStatus.ARCHIVED]: "badge-ghost",
  [EditionStatus.PREPARING]: "badge-warning",
};

export default async function EditionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.EXECUTEAVE) {
    notFound();
  }
  const isAdmin = session.user.role === Role.ADMIN;
  const editions = await getAllEditions();
  // The dialog suggests the first year that is neither past nor taken.
  const thisYear = toMadridDateTime(getNow()).year;
  const suggestedYear = Math.max(thisYear, ...editions.map((edition) => edition.year + 1));

  return (
    <div className="flex justify-center">
      <div className="card w-100 lg:w-180 m-5 bg-base-100 shadow-xl p-5">
        <div className="flex gap-5 w-full justify-center items-center mb-4">
          <h1 className="text-center text-xl font-bold tracking-tight md:text-3xl">Ediciones</h1>
          {isAdmin && <CreateEditionDialog suggestedYear={suggestedYear} />}
        </div>
        {editions.length === 0 ? (
          <p className="text-center">Todavía no hay ninguna edición.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Año</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {editions.map((edition) => (
                  <tr key={edition.year}>
                    <td className="tabular-nums">{edition.year}</td>
                    <td>{edition.name}</td>
                    <td>
                      {isAdmin ? (
                        <EditionStatusSelect status={edition.status} year={edition.year} />
                      ) : (
                        <span className={`badge ${STATUS_BADGES[edition.status]}`}>
                          {EDITION_STATUS_LABELS[edition.status]}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        {edition.status === EditionStatus.PREPARING && <DeleteEditionButton year={edition.year} />}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
