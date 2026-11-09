import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import CreateEditionDialog from "@/components/CreateEditionDialog";
import EditionStatusButton from "@/components/ui/EditionStatusButton";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { getNow, toMadridDateTime } from "@/lib/advientea-time";
import { auth } from "@/lib/auth";
import { getAllEditions } from "@/lib/dal";

const STATUS_LABELS: Record<EditionStatus, { className: string; label: string }> = {
  [EditionStatus.ACTIVE]: { className: "badge-success", label: "Activa" },
  [EditionStatus.ARCHIVED]: { className: "badge-ghost", label: "Archivada" },
  [EditionStatus.PREPARING]: { className: "badge-warning", label: "En preparación" },
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
                      <span className={`badge ${STATUS_LABELS[edition.status].className}`}>
                        {STATUS_LABELS[edition.status].label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        {edition.status === EditionStatus.PREPARING && (
                          <div className="flex justify-end gap-2">
                            <EditionStatusButton change="activate" year={edition.year} />
                            <EditionStatusButton change="delete" year={edition.year} />
                          </div>
                        )}
                        {edition.status === EditionStatus.ACTIVE && (
                          <EditionStatusButton change="archive" year={edition.year} />
                        )}
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
