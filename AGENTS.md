# AGENTS.md

Guidance for anyone, human or coding agent, working on this repository. Documentation is written in English; user-facing strings in the app are Spanish.

## Project at a glance

Advienté is a tea advent calendar: 25 days in December, one tea per day, each day owned by one person who writes a short story and brewing notes. Everyone else guesses the tea and the author, and a ranking is built from those guesses. The app is live with real users; the 2026 edition is being prepared on top of the 2025 code.

- **Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS 4 + daisyUI 5, Prisma 7 with `@prisma/adapter-pg` on PostgreSQL (Neon), better-auth, Cloudinary, Resend, Sentry, Vitest 4.
- **Hosting:** Vercel. `main` deploys to production, `develop` deploys to the persistent preview `staging-adviente.vercel.app`, every other branch gets a PR preview. Neon creates a database branch per preview (`preview/<git-branch>`).

## Toolchain

Versions are pinned so that local, CI and Vercel build the same way. Vercel builds with Node 24 and pnpm 10 (pnpm 11+ is not supported there), so do not bump these on your own.

- `mise.toml` pins Node and pnpm. Run `mise install` once; CI uses `jdx/mise-action` with the same file. `package.json` repeats the pin in `packageManager` and `engines` for Vercel.
- pnpm only. On Windows, call scripts as `pnpm run <script>` when the name clashes with a system command (`format` does).
- `pnpm-workspace.yaml` lists which dependency build scripts may run (`allowBuilds`). Only lefthook needs its postinstall; the rest have always run blocked in this project.
- Formatting and linting: Prettier (`.prettierrc`) and ESLint flat config (`eslint.config.mjs`): `eslint-config-next`, `eslint-plugin-perfectionist` for import, object and type ordering, and `eslint-config-prettier` last. Line endings are LF everywhere (`.gitattributes`, `.editorconfig`).
- Git hooks via lefthook (`lefthook.yml`): pre-commit formats and lints staged files and type-checks the project; pre-push runs the unit tests. Skip once with `LEFTHOOK=0 git commit ...`, never on shared branches.
- CI: `.github/workflows/ci.yml` runs format check, lint, `tsc`, unit tests and the integration suite (Postgres in Docker) on PRs and pushes to `develop` and `main`.
- Mechanical commits (mass formatting and sorting) are listed in `.git-blame-ignore-revs`. Enable locally with `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

### Commands

| Command                  | What it does                                                        |
| ------------------------ | ------------------------------------------------------------------- |
| `pnpm dev`               | Dev server with Turbopack                                           |
| `pnpm lint`              | ESLint                                                              |
| `pnpm run format`        | Prettier, write                                                     |
| `pnpm format:check`      | Prettier, check only (CI)                                           |
| `pnpm exec tsc --noEmit` | Type-check                                                          |
| `pnpm test:u`            | Unit tests (`__tests__/unit`)                                       |
| `pnpm test:i`            | Integration tests against Docker Postgres (`__tests__/integration`) |
| `pnpm docker:up`         | Start the test Postgres (`localhost:5433/tests`)                    |
| `pnpm db:seed`           | Seed the database that `DATABASE_URL` points to (dev only)          |

## Environments and data safety

These rules exist because the app has production users and a shared Cloudinary account. Read them before running anything.

- **Never touch the production database.** `.env` holds the local dev database (`localhost:5432`). The production connection string must never be used from a developer machine.
- **Previews refuse the production database.** `src/lib/database-guard.ts` runs from `prisma.config.ts` (every Prisma CLI call, install included) and from `src/lib/prisma.ts`: when `VERCEL_ENV` is `preview`, the database host must differ from `PRODUCTION_DB_HOST` (a public Vercel variable, hostname only) or the build fails. Neon normally injects a branch database per preview; this guard covers the case where it does not and the fallback `DATABASE_URL` would be production. Migrations use `DATABASE_URL_UNPOOLED` when present.
- **Tests use the Docker Postgres only.** `.env.test` (committed, no secrets) points to `localhost:5433/tests`; `.env.test.local` (gitignored) may override it. The integration suite resets and reseeds that database on every test.
- **Do not run `pnpm build` locally against a real database.** The build script runs `prisma migrate deploy` first. `prisma migrate ...` and `pnpm db:reset` act on whatever `DATABASE_URL` resolves to through `prisma.config.ts` (that is `.env`, never `.env.test`), so run them only when that is your local dev database or the Docker test database (`pnpm dotenv -e .env.test -- prisma migrate reset`).
- **Cloudinary is one shared account for every environment.** The app deletes the previous asset when an avatar or a story image is replaced. Never exercise those flows against rows that reference production assets; use disposable test assets. A per-environment folder and a delete guard are planned.
- **Staging data is a copy of production.** The `preview/develop` Neon branch is copy-on-write: writes stay in staging, but it contains real user data and sits behind Vercel SSO. Use throwaway accounts there.
- Secrets live in Vercel as Sensitive variables. Never print, log or commit them.

## Architecture

- `src/app/<feature>/` holds routes; auth pages are flat (`sign-in`, `sign-up`, `reset-password`).
- `src/app/actions/*` are Server Actions. **They are public POST endpoints**: every exported action starts with `requireSession()` or `requireRole(...)` from `src/lib/dal/dal-auth.ts` (exceptions: `signup`, `signin`, `signout`, and `addTeaInfo`, which allows guests on purpose). `__tests__/unit/serverAction/actionsAuthSweep.test.ts` enforces this for every action module; add new actions there.
- `src/lib/dal/` is the data access layer and where Prisma queries belong. `src/lib/services/` holds business logic (scoring, rankings, users); `ranking-service.ts` still queries Prisma directly and should move its queries to the DAL when touched. `src/lib/auth.ts` hands the client to better-auth's Prisma adapter. `src/lib/schemas/` holds the Zod 4 schemas shared by forms and actions. `src/lib/errors.ts` defines `UnauthenticatedError` and `ForbiddenError`.
- Roles (`Role` enum): `ADMIN`, `EXECUTEAVE` (calendar manager) and `USER`. Only `ADMIN` changes roles, creates or deletes days and sees `/users`. `ADMIN` and `EXECUTEAVE` assign days and edit any tea. `USER` edits only the tea of their own `DayAssignment` for the active year.
- Mutation actions called from client components return `ActionResponse { success, message }` with Spanish messages; form actions used with `useActionState` return the extended `*ActionResponse` shapes from `src/lib/types.ts`, which add `errors` and `inputs` so the form can show field errors and keep what the user typed. Client components show the message through `useActionToast` / `ActionToast` (`src/components/ui/ActionToast.tsx`), a stopgap until the planned move to shadcn/ui and sonner.
- Editing a story's images goes through `replaceStoryImages(storyTeaId, slots)` in `src/lib/dal/dal-story-image.ts`: one transaction, ids scoped to the story, removed assets returned for deletion after commit. Creation in `addTeaInfo` still inserts images one by one with `addStoryImage`; new code should use `replaceStoryImages`.
- Day visibility and the reveal schedule live in `src/lib/advientea-rules.ts`; guessing rules in `src/lib/services/tea-guess-service.ts`; scoring in `src/lib/tea-guess-scoring.ts`.
- `src/generated/prisma/` is generated by `prisma generate` on install. Do not edit it or `prisma/migrations/` by hand.

## Conventions

- Code, comments and docs in English; UI copy in Spanish. Comment only the non-obvious why, never the what.
- Server Components by default, `"use client"` only where there is interactivity. Forms use Server Actions with `useActionState`.
- Commits: `<type>: <description>`, at most 72 characters, `(#issue)` when the work is tracked. Types: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`, `style`, `ci`. Keep mechanical changes (formatting, sorting, renames) in their own commits.
- Branches: `main` is production, `develop` is staging. Work on short-lived branches and open PRs to `develop`; `develop` goes to `main` by PR when staging has been checked.
- Tests first for logic: unit tests for scoring, rules and services with mocked DAL; integration tests for DAL functions and anything that depends on database constraints.
- Before relying on a library behaviour, check the official documentation for the installed version. Several past assumptions about Next.js, better-auth and Prisma turned out to be wrong.

## Working here as an agent

- Keep diffs focused. Formatting is handled by the hooks; do not reformat untouched code or rewrite existing comments.
- Never run destructive commands (`db:reset`, migrations, data deletion, Cloudinary deletions) outside the Docker test database without an explicit instruction, and never against production.
- Vercel, Neon and GitHub operations are read-only unless the task says otherwise.
- When a check cannot be run, say so instead of assuming it passed.

## References

- `README.md`: setup and getting started.
- `.github/copilot-instructions.md` and `.github/instructions/daisyui.instructions.md`: styling and daisyUI conventions.
- GitHub Project #17 tracks the work: https://github.com/users/CarlosCanet/projects/17
