import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { Role } from "@/generated/prisma/enums";

/**
 * Authorization sweep over EVERY module in src/app/actions (picked up by glob, not registered by hand).
 *
 * Two properties:
 *  1. With no session, no action reaches the DAL, Prisma or Cloudinary.
 *  2. With a plain USER session, no privileged action reaches them either.
 * A new action is covered automatically; forgetting its guard fails this test instead of shipping.
 */

// Public by design. Adding a name here is a reviewable decision.
const PUBLIC_ACTIONS: Record<string, string> = {
  signup: "creates the account itself",
  signin: "authenticates; there is no session yet",
  signout: "ends the session; harmless without one",
  addTeaInfo: "guest submissions are allowed by product decision (2026-10-19); the only unauthenticated write path",
};

// Require ADMIN or EXECUTEAVE. A USER must never get past the guard.
const PRIVILEGED_ACTIONS: Record<string, string> = {
  changeRoleAction: "ADMIN",
  assignUserToDay: "ADMIN or EXECUTEAVE",
  addDaysAction: "ADMIN",
  deleteDayAction: "ADMIN",
};

const { GUARDS, DAL_FUNCTIONS, prismaTouched } = vi.hoisted(() => ({
  GUARDS: ["requireSession", "requireRole", "verifySession"] as const,
  // Every DAL export the action modules import. Keep in sync with their `@/lib/dal` imports.
  DAL_FUNCTIONS: [
    "add25Days",
    "addDay",
    "addDayAssignment",
    "addStoryImage",
    "addStoryTea",
    "addTea",
    "changeUserRole",
    "createTeaGuess",
    "deleteDay",
    "deleteDayAssignmentByDay",
    "editStoryTea",
    "editTea",
    "editUser",
    "getDayAssignmentByUserId",
    "getTea",
    "replaceStoryImages",
    "upsertDayAssignment",
  ] as const,
  prismaTouched: vi.fn(),
}));

vi.mock("@/lib/dal", () => {
  const mocks: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of DAL_FUNCTIONS) mocks[name] = vi.fn();
  for (const name of GUARDS) mocks[name] = vi.fn();
  return mocks;
});
// Any direct use of the Prisma client from an action is recorded and fails the sweep.
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, prop) => {
        prismaTouched(String(prop));
        return () => undefined;
      },
    },
  ),
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOut: vi.fn(),
      changePassword: vi.fn(),
    },
  },
}));
vi.mock("@/lib/cloudinary", () => ({ uploadImageFile: vi.fn(), deleteAsset: vi.fn() }));
vi.mock("@/lib/services/user-service", () => ({ createUser: vi.fn() }));
vi.mock("@/lib/services/tea-guess-service", () => ({
  canUserGuessTea: vi.fn(),
  canUserGuessPerson: vi.fn(),
  validateTeaGuess: vi.fn().mockResolvedValue({ success: false, error: { errors: [] }, inputs: {} }),
  calculatePointsFromGuess: vi.fn(),
}));

import * as dal from "@/lib/dal";
import * as cloudinary from "@/lib/cloudinary";
import * as authActions from "@/app/actions/authActions";
import * as teaInfoActions from "@/app/actions/teaInfoActions";
import * as teaGuessActions from "@/app/actions/teaGuessActions";

type ActionModule = Record<string, unknown>;
const MODULES: Record<string, ActionModule> = { authActions, teaInfoActions, teaGuessActions };
// commonActions.ts holds form-parsing helpers, not Server Actions.
const NON_ACTION_FILES = new Set(["commonActions"]);
const ACTIONS_DIR = path.join(process.cwd(), "src", "app", "actions");
const ALL_ACTIONS = Object.entries(MODULES).flatMap(([moduleName, mod]) =>
  Object.entries(mod)
    .filter(([, value]) => typeof value === "function")
    .map(([actionName, action]) => ({
      moduleName,
      actionName,
      action: action as (...args: unknown[]) => Promise<unknown>,
    })),
);

// Arity differs between actions; every parameter gets a FormData so form-based ones parse an empty form
// instead of crashing on null, and id-based ones reach the guard before looking at their arguments.
const dummyArgs = () => [new FormData(), new FormData(), new FormData()];

const dalMock = dal as unknown as Record<string, ReturnType<typeof vi.fn>>;
const cloudinaryMock = cloudinary as unknown as Record<string, ReturnType<typeof vi.fn>>;

function expectNoWrites(actionName: string) {
  for (const name of DAL_FUNCTIONS) {
    expect(dalMock[name], `${actionName} reached dal.${name}`).not.toHaveBeenCalled();
  }
  expect(prismaTouched, `${actionName} used the Prisma client directly`).not.toHaveBeenCalled();
  for (const name of ["uploadImageFile", "deleteAsset"]) {
    expect(cloudinaryMock[name], `${actionName} reached cloudinary.${name}`).not.toHaveBeenCalled();
  }
}

const userSession = {
  isAuth: true as const,
  userId: "user-id",
  role: Role.USER,
  user: {
    id: "user-id",
    email: "user@example.com",
    name: "user",
    username: "user",
    role: Role.USER,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe("authorization sweep", () => {
  it("covers every action module on disk and lists only real actions as public or privileged", () => {
    // A new file in src/app/actions must be added to MODULES, or this fails: nothing escapes the sweep silently.
    const onDisk = readdirSync(ACTIONS_DIR)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => file.replace(/\.ts$/, ""))
      .filter((name) => !NON_ACTION_FILES.has(name))
      .sort();
    expect(Object.keys(MODULES).sort()).toEqual(onDisk);
    const allNames = ALL_ACTIONS.map((a) => a.actionName);
    for (const name of [...Object.keys(PUBLIC_ACTIONS), ...Object.keys(PRIVILEGED_ACTIONS)]) {
      expect(allNames, `${name} is listed but no action module exports it`).toContain(name);
    }
  });

  describe("no session: nothing reaches the DAL", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      dalMock.requireSession.mockRejectedValue(new UnauthenticatedError());
      dalMock.requireRole.mockRejectedValue(new UnauthenticatedError());
      dalMock.verifySession.mockResolvedValue({ isAuth: false, userId: null, role: null, user: null });
    });

    for (const { moduleName, actionName, action } of ALL_ACTIONS) {
      if (actionName in PUBLIC_ACTIONS) {
        // Public actions are exercised with an empty form, which proves nothing about writes: they are documented, not asserted.
        it.skip(`${moduleName}.${actionName} is public: ${PUBLIC_ACTIONS[actionName]}`, () => {});
        continue;
      }
      it(`${moduleName}.${actionName} asks for a session and never writes`, async () => {
        await action(...dummyArgs()).catch(() => undefined);
        expectNoWrites(actionName);
        const guardConsulted = GUARDS.some((g) => dalMock[g].mock.calls.length > 0);
        expect(guardConsulted, `${actionName} never asked for a session`).toBe(true);
      });
    }
  });

  describe("USER session: privileged actions are refused before any write", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      dalMock.requireSession.mockResolvedValue(userSession);
      dalMock.verifySession.mockResolvedValue(userSession);
      dalMock.requireRole.mockImplementation(async (...roles: Role[]) => {
        if (roles.includes(Role.USER)) return userSession;
        throw new ForbiddenError();
      });
    });

    for (const { moduleName, actionName, action } of ALL_ACTIONS) {
      if (!(actionName in PRIVILEGED_ACTIONS)) continue;
      it(`${moduleName}.${actionName} (${PRIVILEGED_ACTIONS[actionName]}) refuses a USER`, async () => {
        await action(...dummyArgs()).catch(() => undefined);
        expectNoWrites(actionName);
        expect(dalMock.requireRole, `${actionName} never checked the role`).toHaveBeenCalled();
      });
    }
  });
});
