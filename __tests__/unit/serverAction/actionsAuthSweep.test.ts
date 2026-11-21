import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/generated/prisma/enums";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";

/**
 * Authorization sweep over EVERY module in src/app/actions (picked up by glob, not registered by hand).
 *
 * Properties:
 *  1. With no session, no action reaches the DAL, Prisma or Cloudinary.
 *  2. With a plain USER session, no privileged action reaches them either.
 *  3. With an EXECUTEAVE session, no ADMIN-only action reaches them, and the guard of every action
 *     shared with the calendar manager lets it through.
 *  4. With an ADMIN session, the guard of every privileged action lets it through.
 * A new action is covered automatically; forgetting its guard fails this test instead of shipping.
 */

// Public by design. Adding a name here is a reviewable decision.
const PUBLIC_ACTIONS: Record<string, string> = {
  addTeaInfo: "guest submissions are allowed by product decision (2026-10-19); the only unauthenticated write path",
  signin: "authenticates; there is no session yet",
  signout: "ends the session; harmless without one",
  signup: "creates the account itself",
};

// Ask for a session and no role: any signed-in person may call them, and what they reach is decided from the
// session itself. Every action not listed above is held to this anyway; these are named so the decision is reviewable.
const SESSION_ACTIONS: Record<string, string> = {
  saveMyTeaAction: "a participant saves their own tea; the participation comes from the session, never from the form",
};

type AllowedRoles = "ADMIN" | "ADMIN or EXECUTEAVE";

// Require ADMIN or EXECUTEAVE. A USER must never get past the guard, and neither must an EXECUTEAVE
// where the label says ADMIN: the labels are enforced below, one session role at a time.
const PRIVILEGED_ACTIONS: Record<string, AllowedRoles> = {
  changeEditionStatusAction: "ADMIN",
  changeRoleAction: "ADMIN",
  createEditionAction: "ADMIN",
  deleteDayAction: "ADMIN",
  deleteEditionAction: "ADMIN",
  enrolGuestAction: "ADMIN or EXECUTEAVE",
  enrolUserAction: "ADMIN or EXECUTEAVE",
  placeParticipantAction: "ADMIN or EXECUTEAVE",
  swapParticipantsAction: "ADMIN or EXECUTEAVE",
  unenrolParticipantAction: "ADMIN or EXECUTEAVE",
};

const ROLES_OF: Record<AllowedRoles, Role[]> = {
  ADMIN: [Role.ADMIN],
  "ADMIN or EXECUTEAVE": [Role.ADMIN, Role.EXECUTEAVE],
};

const { DAL_FUNCTIONS, GUARDS, prismaTouched } = vi.hoisted(() => ({
  GUARDS: ["requireSession", "requireRole", "verifySession"] as const,
  // Every DAL export the action modules import, directly or through the services they call (left real here, so
  // that what a service reaches is seen too). Keep in sync with their `@/lib/dal` imports.
  DAL_FUNCTIONS: [
    "addDay",
    "assignDay",
    "addStoryImage",
    "addStoryTea",
    "addTea",
    "changeEditionStatus",
    "changeUserRole",
    "createEdition",
    "createTeaGuess",
    "deleteDay",
    "deleteEdition",
    "editUser",
    "enrolGuest",
    "enrolUser",
    "getActiveEdition",
    "getEdition",
    "getOpenParticipationByUserId",
    "getParticipationById",
    "getParticipationByUserId",
    "getTeaById",
    "isParticipationDayPlayed",
    "placeParticipant",
    "replaceStoryImages",
    "saveParticipationTea",
    "swapParticipants",
    "unenrolParticipant",
    "unplaceParticipant",
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
      changePassword: vi.fn(),
      getSession: vi.fn().mockResolvedValue(null),
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      signUpEmail: vi.fn(),
    },
  },
}));
vi.mock("@/lib/cloudinary", () => ({ deleteAsset: vi.fn(), uploadImage: vi.fn() }));
vi.mock("@/lib/services/user-service", () => ({ createUser: vi.fn() }));
vi.mock("@/lib/services/tea-guess-service", () => ({
  calculatePointsFromGuess: vi.fn(),
  canUserGuessPerson: vi.fn(),
  canUserGuessTea: vi.fn(),
  validateTeaGuess: vi.fn().mockResolvedValue({ error: { errors: [] }, inputs: {}, success: false }),
}));

import * as authActions from "@/app/actions/authActions";
import * as editionActions from "@/app/actions/editionActions";
import * as teaGuessActions from "@/app/actions/teaGuessActions";
import * as teaInfoActions from "@/app/actions/teaInfoActions";
import * as cloudinary from "@/lib/cloudinary";
import * as dal from "@/lib/dal";

type ActionModule = Record<string, unknown>;
const MODULES: Record<string, ActionModule> = { authActions, editionActions, teaGuessActions, teaInfoActions };
// commonActions.ts holds form-parsing helpers, not Server Actions.
const NON_ACTION_FILES = new Set(["commonActions"]);
const ACTIONS_DIR = path.join(process.cwd(), "src", "app", "actions");
const ALL_ACTIONS = Object.entries(MODULES).flatMap(([moduleName, mod]) =>
  Object.entries(mod)
    .filter(([, value]) => typeof value === "function")
    .map(([actionName, action]) => ({
      action: action as (...args: unknown[]) => Promise<unknown>,
      actionName,
      moduleName,
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
  for (const name of ["uploadImage", "deleteAsset"]) {
    expect(cloudinaryMock[name], `${actionName} reached cloudinary.${name}`).not.toHaveBeenCalled();
  }
}

function sessionOf(role: Role) {
  return {
    isAuth: true as const,
    role,
    user: {
      createdAt: new Date(),
      email: "user@example.com",
      emailVerified: false,
      id: "user-id",
      name: "user",
      role,
      updatedAt: new Date(),
      username: "user",
    },
    userId: "user-id",
  };
}

/** Opens a session with that role. `requireRole` answers by the contract of the real guard, whatever it is asked. */
function signInAs(role: Role) {
  const session = sessionOf(role);
  dalMock.requireSession.mockResolvedValue(session);
  dalMock.verifySession.mockResolvedValue(session);
  dalMock.requireRole.mockImplementation(async (...roles: Role[]) => {
    if (roles.includes(role)) {
      return session;
    }
    throw new ForbiddenError();
  });
}

/** How the guard answered each time the action asked for a role: "fulfilled" let it through, "rejected" refused. */
function guardAnswers() {
  return dalMock.requireRole.mock.settledResults.map((result) => result.type);
}

// An action that got past the guard would still stop at its dummy arguments before writing, so "nothing
// was written" alone cannot tell a refusal from a wrong role list: the guard's own answer can.
function expectRefusedByTheGuard(actionName: string, role: Role) {
  const answers = guardAnswers();
  expect(answers.length, `${actionName} never checked the role`).toBeGreaterThan(0);
  expect(answers, `${actionName} lets a session with the role ${role} past its guard`).not.toContain("fulfilled");
}

function expectLetThroughByTheGuard(actionName: string, role: Role) {
  const answers = guardAnswers();
  expect(answers.length, `${actionName} never checked the role`).toBeGreaterThan(0);
  expect(new Set(answers), `${actionName} refuses a session with the role ${role}`).toEqual(new Set(["fulfilled"]));
}

const PRIVILEGED = ALL_ACTIONS.filter(({ actionName }) => actionName in PRIVILEGED_ACTIONS).map((entry) => ({
  ...entry,
  allowed: PRIVILEGED_ACTIONS[entry.actionName],
}));

const SESSION_ONLY = ALL_ACTIONS.filter(
  ({ actionName }) => !(actionName in PUBLIC_ACTIONS) && !(actionName in PRIVILEGED_ACTIONS),
);

// Without a session an action that asks for the session first and for a role later stops at the first guard,
// so only a session shows that it asks for a role at all. Then it has to be listed, or no property above
// would say which roles it must take.
function itAsksNoRoleUnlessListed() {
  for (const { action, actionName, moduleName } of SESSION_ONLY) {
    it(`${moduleName}.${actionName} is not listed as privileged and asks for no role`, async () => {
      await action(...dummyArgs()).catch(() => undefined);
      expect(
        dalMock.requireRole,
        `${actionName} asks for a role but is not listed in PRIVILEGED_ACTIONS`,
      ).not.toHaveBeenCalled();
    });
  }
}

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
    for (const name of [
      ...Object.keys(PUBLIC_ACTIONS),
      ...Object.keys(PRIVILEGED_ACTIONS),
      ...Object.keys(SESSION_ACTIONS),
    ]) {
      expect(allNames, `${name} is listed but no action module exports it`).toContain(name);
    }
  });

  it("lists the session-only actions in no other list", () => {
    const sessionOnly = SESSION_ONLY.map(({ actionName }) => actionName);
    for (const name of Object.keys(SESSION_ACTIONS)) {
      expect(name in PUBLIC_ACTIONS, `${name} is listed both as public and as session-only`).toBe(false);
      expect(name in PRIVILEGED_ACTIONS, `${name} is listed both as privileged and as session-only`).toBe(false);
      expect(sessionOnly).toContain(name);
    }
  });

  it("finds each action in one module only", () => {
    // The lists above go by name alone, so a copy left behind when an action moves would hide behind the new one.
    const modulesByAction = new Map<string, string[]>();
    for (const { actionName, moduleName } of ALL_ACTIONS) {
      modulesByAction.set(actionName, [...(modulesByAction.get(actionName) ?? []), moduleName]);
    }
    const repeated = [...modulesByAction].filter(([, modules]) => modules.length > 1);
    expect(repeated).toEqual([]);
  });

  describe("no session: nothing reaches the DAL", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      dalMock.requireSession.mockRejectedValue(new UnauthenticatedError());
      dalMock.requireRole.mockRejectedValue(new UnauthenticatedError());
      dalMock.verifySession.mockResolvedValue({ isAuth: false, role: null, user: null, userId: null });
    });

    for (const { action, actionName, moduleName } of ALL_ACTIONS) {
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
        // The role properties below only run over the listed actions, so one that asks for a role must be listed.
        const asksForRole = dalMock.requireRole.mock.calls.length > 0;
        expect(
          asksForRole && !(actionName in PRIVILEGED_ACTIONS),
          `${actionName} asks for a role but is not listed in PRIVILEGED_ACTIONS`,
        ).toBe(false);
      });
    }
  });

  describe("USER session: privileged actions are refused before any write", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      signInAs(Role.USER);
    });

    itAsksNoRoleUnlessListed();

    for (const { action, actionName, allowed, moduleName } of PRIVILEGED) {
      it(`${moduleName}.${actionName} (${allowed}) refuses a USER`, async () => {
        await action(...dummyArgs()).catch(() => undefined);
        expectNoWrites(actionName);
        expectRefusedByTheGuard(actionName, Role.USER);
      });
    }
  });

  describe("EXECUTEAVE session: ADMIN-only actions are refused before any write, the shared ones let it in", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      signInAs(Role.EXECUTEAVE);
    });

    itAsksNoRoleUnlessListed();

    for (const { action, actionName, allowed, moduleName } of PRIVILEGED) {
      if (ROLES_OF[allowed].includes(Role.EXECUTEAVE)) {
        it(`${moduleName}.${actionName} (${allowed}) lets an EXECUTEAVE past its guard`, async () => {
          await action(...dummyArgs()).catch(() => undefined);
          expectLetThroughByTheGuard(actionName, Role.EXECUTEAVE);
        });
        continue;
      }
      it(`${moduleName}.${actionName} (${allowed}) refuses an EXECUTEAVE`, async () => {
        await action(...dummyArgs()).catch(() => undefined);
        expectNoWrites(actionName);
        expectRefusedByTheGuard(actionName, Role.EXECUTEAVE);
      });
    }
  });

  describe("ADMIN session: every privileged action lets it in, asking for exactly the roles it lists", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      signInAs(Role.ADMIN);
    });

    itAsksNoRoleUnlessListed();

    for (const { action, actionName, allowed, moduleName } of PRIVILEGED) {
      it(`${moduleName}.${actionName} (${allowed}) lets an ADMIN past its guard`, async () => {
        await action(...dummyArgs()).catch(() => undefined);
        expectLetThroughByTheGuard(actionName, Role.ADMIN);
      });

      it(`${moduleName}.${actionName} asks the guard for ${allowed} and no other role`, async () => {
        await action(...dummyArgs()).catch(() => undefined);
        const asked = dalMock.requireRole.mock.calls.map((roles) => [...new Set(roles as Role[])].toSorted());
        expect(asked.length, `${actionName} never checked the role`).toBeGreaterThan(0);
        for (const roles of asked) {
          expect(roles, `${actionName} asks for other roles than ${allowed}`).toEqual(ROLES_OF[allowed].toSorted());
        }
      });
    }
  });
});
