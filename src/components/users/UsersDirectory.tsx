"use client";

import { Search } from "lucide-react";
import { useId, useState } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ManagerRoleSwitch from "@/components/users/ManagerRoleSwitch";
import { Role } from "@/generated/prisma/enums";

interface DirectoryUser {
  email: string;
  id: string;
  role: Role;
  username: string;
}

interface UsersDirectoryProps {
  /** Only an admin changes roles; everyone else sees the list without the switches. */
  canChangeRoles: boolean;
  users: Array<DirectoryUser>;
}

/** Lower case and without accents, so "jose" finds "José". */
function toSearchable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function toCountLabel(shown: number, total: number): string {
  const totalLabel = total === 1 ? "1 usuario" : `${total} usuarios`;
  return shown === total ? totalLabel : `${shown} de ${totalLabel}`;
}

export default function UsersDirectory({ canChangeRoles, users }: UsersDirectoryProps) {
  const [query, setQuery] = useState("");
  const countId = useId();

  const needle = toSearchable(query.trim());
  const shown =
    needle === ""
      ? users
      : users.filter(
          (user) => toSearchable(user.username).includes(needle) || toSearchable(user.email).includes(needle),
        );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="bg-popover sm:max-w-xs">
          <InputGroupInput
            aria-describedby={countId}
            aria-label="Buscar usuarios"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por usuario o email"
            type="search"
            value={query}
          />
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
        </InputGroup>
        <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums" id={countId}>
          {toCountLabel(shown.length, users.length)}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-base">Ningún usuario coincide con «{query.trim()}».</p>
      ) : (
        <>
          <ItemGroup className="gap-2 md:hidden">
            {shown.map((user) => (
              <Item className="bg-popover ring-1 ring-foreground/10" key={user.id} role="listitem" size="sm">
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full text-base">
                    <span className="truncate">{user.username}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate">{user.email}</ItemDescription>
                </ItemContent>
                {canChangeRoles && user.role !== Role.ADMIN && (
                  <ItemActions>
                    <span aria-hidden="true" className="text-sm">
                      Gerente
                    </span>
                    <ManagerRoleSwitch role={user.role} userId={user.id} username={user.username} />
                  </ItemActions>
                )}
              </Item>
            ))}
          </ItemGroup>

          <div className="hidden md:block">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1">Nº</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  {canChangeRoles && <TableHead className="w-1 text-center">Gerente</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((user, index) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="max-w-80 truncate text-muted-foreground">{user.email}</TableCell>
                    {canChangeRoles && (
                      <TableCell className="text-center">
                        <ManagerRoleSwitch role={user.role} userId={user.id} username={user.username} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
