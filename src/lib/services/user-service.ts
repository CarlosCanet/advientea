import { Role } from "@/generated/prisma/enums";

import { auth } from "../auth";
import { changeUserRole, deleteUser } from "../dal/dal-user";

export interface CreateUserDTO {
  email: string;
  image?: string;
  password: string;
  role?: Role;
  username: string;
}

export async function createUser(data: CreateUserDTO) {
  const body = {
    callbackURL: "/profile",
    email: data.email,
    name: data.username,
    password: data.password,
    username: data.username,
    ...(data.image && { image: data.image }),
  };

  const result = await auth.api.signUpEmail({ body });
  if (!result?.user?.id) {
    throw new Error("User creation failed");
  }

  if (data.role && data.role !== Role.USER) {
    await changeUserRole(result.user.id, data.role);
  }

  return result.user;
}

function canAssignRole(requestedRole: Role, callerRole?: Role): boolean {
  if (requestedRole !== Role.USER && !callerRole) return false;
  if (requestedRole === Role.ADMIN || requestedRole === Role.EXECUTEAVE) {
    return callerRole === Role.ADMIN;
  }
  return true;
}

export async function deleteUserService(id: string, callerRole?: Role) {
  if (callerRole !== Role.ADMIN) throw new Error("Only admins can delete users");
  const result = await deleteUser(id);
  return result;
}
