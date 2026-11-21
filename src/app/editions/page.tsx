import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CreateEditionDialog from "@/components/CreateEditionDialog";
import DeleteEditionButton from "@/components/editions/DeleteEditionButton";
import EditionStatusBadge from "@/components/editions/EditionStatusBadge";
import EditionStatusSelect from "@/components/editions/EditionStatusSelect";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { getNow, toMadridDateTime } from "@/lib/advientea-time";
import { getAllEditions, getSession } from "@/lib/dal";

export default async function EditionsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.EXECUTEAVE) {
    notFound();
  }
  const isAdmin = session.user.role === Role.ADMIN;
  const editions = await getAllEditions();
  // The dialog suggests the year after the newest edition, never a past one.
  const thisYear = toMadridDateTime(getNow()).year;
  const suggestedYear = Math.max(thisYear, ...editions.map((edition) => edition.year + 1));

  return (
    <div className="px-4 py-5">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="flex flex-wrap items-center justify-center gap-4">
          <h1 className="font-display text-2xl sm:text-3xl">Ediciones</h1>
          {isAdmin && <CreateEditionDialog suggestedYear={suggestedYear} />}
        </CardHeader>
        <CardContent>
          {editions.length === 0 ? (
            <p className="text-center text-base">Todavía no hay ninguna edición.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Año</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  {isAdmin && (
                    <TableHead>
                      <span className="sr-only">Borrar</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {editions.map((edition) => (
                  <TableRow key={edition.year}>
                    <TableCell className="tabular-nums">
                      <Link
                        className="rounded-sm font-medium underline underline-offset-4 focus-visible:focus-ring"
                        href={`/editions/${edition.year}`}
                      >
                        {edition.year}
                      </Link>
                    </TableCell>
                    <TableCell>{edition.name}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <EditionStatusSelect status={edition.status} year={edition.year} />
                      ) : (
                        <EditionStatusBadge status={edition.status} />
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {edition.status === EditionStatus.PREPARING && <DeleteEditionButton year={edition.year} />}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
