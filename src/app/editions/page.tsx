import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CreateEditionDialog from "@/components/CreateEditionDialog";
import DeleteEditionButton from "@/components/editions/DeleteEditionButton";
import EditionActionsMenu from "@/components/editions/EditionActionsMenu";
import EditionStatusBadge from "@/components/editions/EditionStatusBadge";
import EditionStatusSelect from "@/components/editions/EditionStatusSelect";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemTitle } from "@/components/ui/item";
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
  const canDelete = (status: EditionStatus) => isAdmin && status === EditionStatus.PREPARING;

  return (
    <div className="px-4 py-5">
      <Card className="mx-auto w-full max-w-3xl max-sm:[--card-spacing:--spacing(4)]">
        <CardHeader className="flex flex-wrap items-center justify-center gap-4">
          <h1 className="font-display text-2xl sm:text-3xl">Ediciones</h1>
          {isAdmin && <CreateEditionDialog suggestedYear={suggestedYear} />}
        </CardHeader>
        <CardContent>
          {editions.length === 0 ? (
            <p className="text-center text-base">Todavía no hay ninguna edición.</p>
          ) : (
            <>
              <ItemGroup className="gap-2 md:hidden">
                {editions.map((edition) => (
                  <Item className="bg-popover ring-1 ring-foreground/10" key={edition.year} role="listitem" size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="text-lg tabular-nums">
                        <Link
                          className="rounded-sm font-semibold underline underline-offset-4 focus-visible:focus-ring pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                          href={`/editions/${edition.year}`}
                        >
                          {edition.year}
                        </Link>
                      </ItemTitle>
                      <ItemDescription className="text-foreground">{edition.name}</ItemDescription>
                    </ItemContent>
                    {canDelete(edition.status) && <EditionActionsMenu year={edition.year} />}
                    <ItemFooter className="justify-start">
                      {isAdmin ? (
                        <EditionStatusSelect status={edition.status} year={edition.year} />
                      ) : (
                        <EditionStatusBadge status={edition.status} />
                      )}
                    </ItemFooter>
                  </Item>
                ))}
              </ItemGroup>
              <div className="hidden md:block">
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
                            {canDelete(edition.status) && <DeleteEditionButton year={edition.year} />}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
