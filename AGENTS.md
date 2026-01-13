# AGENTS.md

> **Note:** All project documentation is maintained in English for consistency, collaboration, and better integration with AI tools and international development standards.

## Overview

This project is an Advent Tea Calendar built with Next.js 16.0 (App Router), React 19.2, TypeScript 5, Tailwind CSS v4, and daisyUI 5.3.9. 

**Core Features:**
- **Authentication System:** Secure user registration, login, and password recovery using BetterAuth and Resend for email delivery
- **Tea Calendar:** Interactive advent calendar (grid layout) with daily tea reveals at 21:00 UTC
- **Gamification:** Users guess tea names daily, earning points based on accuracy and timing
- **User Roles:** Admin (full access) and User (assigned to one specific day)
- **Story Content:** Each day has a narrative with progressive reveals and optional YouTube media
- **Ranking System:** Daily and overall leaderboards highlighting top 3 users with avatars
- **Badges:** Achievement system for special accomplishments (first correct guess, most guessed tea, etc.)
- **Image Management:** Cloudinary integration for user avatars and tea day images
- **TDD Approach:** Test-Driven Development using Vitest and React Testing Library
- **Form Handling:** Server Actions (native Next.js 16) with progressive enhancement
- **Scoring Algorithm:** Levenshtein distance using fastest-levenshtein library

The project emphasizes server components, performance, security, and maintainability.

## Agent Roles & Responsibilities

### 1. UI/UX Agent
- Implements user interfaces using daisyUI v5 and Tailwind CSS v4
- Ensures responsive, accessible, and visually consistent components
- Follows the design system and color variables defined in `globals.css`
- Uses Geist fonts and applies font variables in layouts

### 2. Server Component Agent
- Builds server components by default ("use client" only when needed)
- Handles data fetching, static optimization, and error boundaries
- Implements Server Actions for form handling (native Next.js 16 pattern)
- Implements API routes when needed for non-form endpoints in `src/app/api/`
- Ensures security (input validation, authentication, CSRF, etc.)
- Uses async params pattern in dynamic routes: `const { id } = await params`

### 3. Client Component Agent
- Adds interactivity with React hooks and client-side state
- Implements loading and error states using Suspense and `loading.tsx`/`error.tsx`
- Keeps state close to where it is used

### 4. TypeScript Agent
- Defines clear interfaces and types for all data and props
- Uses strict mode and type guards
- Validates runtime data as needed (Zod can be added post-MVP)

### 5. Styling Agent
- Applies Tailwind v4 and daisyUI v5 classes for all components
- Uses utility classes for layout, spacing, and responsiveness
- Supports dark mode and container queries

### 6. Performance Agent
- Optimizes images with `next/image`
- Implements code splitting and route prefetching
- Uses Turbopack for builds and dev
- Monitors bundle size and static optimization

### 7. Security Agent
- Validates and sanitizes all user input
- Implements authentication with BetterAuth (registration, login, password recovery)
- Manages password hashing with bcryptjs
- Implements authorization checks (admin vs user permissions)
- Protects routes with middleware (admin-only pages, user-assigned day enforcement)
- Follows best practices for secure HTTP methods and data handling
- Implements CSRF protection and rate limiting in API routes

### 8. Database Agent
- Manages Prisma schema and migrations
- Implements data models: User, Day, StoryTea, TeaGuess, Badge, UserBadge, DayImage
- Handles database queries in Server Components
- Ensures data integrity with proper relations and constraints
- Manages indexes for optimized queries (userId, dayId combinations)
- Uses PostgreSQL for development (configurable for other environments)

### 9. Media Integration Agent
- Handles YouTube embed integration for ambient music/videos
- Implements Cloudinary integration for image uploads (avatars, tea day images)
- Manages responsive media players
- Optimizes media loading and playback performance
- Implements secure upload flows (signed URLs, public_id management)

### 10. Testing Agent
- Implements Test-Driven Development (TDD) approach
- Writes and maintains unit and integration tests using Vitest and React Testing Library
- Tests business logic: scoring algorithm, string similarity, badge awarding
- Tests React components and API routes
- Ensures new features have adequate test coverage
- Runs tests via `npm run test` command
- Mocks dependencies and services as needed

### 11. Authentication Agent
- Implements BetterAuth configuration and setup
- Handles user registration with email verification
- Manages login/logout flows
- Implements password recovery with Resend email service
- Manages session handling and token refresh
- Integrates auth state with Next.js Server Components and Client Components

### 12. Gamification Agent
- Implements tea name guessing logic and scoring algorithm
- Calculates points based on string similarity (Levenshtein distance using fastest-levenshtein library)
- Awards points considering timing (earlier guesses may get bonus points)
- Manages badge awarding system based on achievements
- Implements daily and overall ranking calculations
- Reveals scores at 21:00 UTC daily (REVEAL_HOUR constant)

### 13. Email Agent
- Configures and manages Resend for transactional emails
- Sends password recovery emails with secure tokens
- Handles email templates for user communications
- Ensures email delivery reliability and error handling

### 14. Documentation Agent
- **ALWAYS** consult Context7 MCP Server (`mcp_context7_*` tools) for:
  - Package documentation (resolve library ID first with `resolve-library-id`, then use `get-library-docs`)
  - API references and function signatures
  - Framework/library usage patterns and best practices
  - Code examples and implementation guides
- Use `mode='code'` for API references and code examples (default)
- Use `mode='info'` for conceptual guides and architectural questions

### 15. Issue Management Agent
- **ALWAYS** consult GitHub MCP Server (`mcp_github_*` tools) for:
  - Retrieving issue details (`mcp_github_search_issues` with specific query)
  - Checking issue requirements, tasks, and acceptance criteria
  - Verifying issue status and assigned labels
  - Reviewing issue comments and discussions
- Search issues by title, number, or labels before starting work
- Use structured queries: `repo:owner/repo is:issue number:X` or `in:title "Issue Title"`

## Agent Collaboration
- Agents communicate via clear TypeScript interfaces and props
- Shared logic and types are placed in common modules
- All agents follow the standards in `.github/copilot-instructions.md`
- Documentation Agent must be consulted before implementing any external library feature
- Issue Management Agent must be consulted before starting work on any issue

## File Structure Reference
## Canonical File Structure Strategy

Instead of maintaining a rigid file tree, follow these architectural patterns:

- **Global Config**: `src/lib/` for shared logic (auth, scoring, rules), `prisma/` for DB schema.
- **Routing**: `src/app/[feature-domain]/` pattern (e.g., `teaDay/`, `ranking/`, `admin-dashboard/`).
- **Auth Pages**: Flat structure `src/app/sign-in`, `src/app/sign-up`, etc.
- **API**: `src/app/api/[resource]/route.ts` for endpoints.
- **Generated Code**: `src/generated/` (do not edit manually).
- **Public Assets**: `/public` for static images/icons.

## Database Schema

### Multi-Year Support
The schema supports multiple calendar editions (2025, 2026, etc.) through the `year` field in Day and DayAssignment models.

### MVP Models (Active)

#### User Model
- Authentication and profile information
- Fields: username, email, password (hashed with bcryptjs), isAdmin, image (Cloudinary URL), createdAt, updatedAt
- Relations: daysAssigned (DayAssignment[]), guesses (TeaGuess[] - BONUS P1), badges (UserBadge[] - Production)
- Unique constraints: username, email

#### Day Model
- Represents a single day in the tea advent calendar
- Fields: dayNumber (1-25), year (default 2025)
- Relations: tea (Tea, 1-to-1), story (StoryTea, 1-to-1), assignment (DayAssignment, 1-to-1), guesses (TeaGuess[] - BONUS P1)
- Unique constraint: [dayNumber, year] - allows same day number across different years
- Reveal time is constant at 21:00 UTC (defined in src/lib/constants.ts)

#### Tea Model
- Tea information (separated from Day for better normalization)
- Fields: dayId, name, infusionTime (minutes), temperature (celsius), hasTheine, canReinfuse, reinfuseNumber, moreIndications, addMilk, storeName, url
- Relations: day (Day, 1-to-1)
- Unique constraint: dayId (one tea per day)
- Cascade delete: if Day is deleted, Tea is deleted
- Note: Intentional duplication allowed (users upload their own tea data without checking for existing teas)

#### DayAssignment Model
- Manages user-to-day assignments with multi-year support
- Fields: userId, dayId, year
- Relations: user (User), day (Day)
- Unique constraints: dayId (one assignment per day), [userId, year] (one day per user per year)
- Index: year (for efficient queries by calendar edition)
- Cascade delete: if User or Day is deleted, assignment is deleted

#### StoryTea Model
- Contains narrative content for each tea day
- Fields: dayId, storyPart1, storyPart2, storyPart3, youtubeURL, onlyMusic
- Relations: day (Day, 1-to-1), images (StoryImage[])
- Unique constraint: dayId
- Cascade delete/update with parent Day

#### StoryImage Model
- Images for tea day stories (formerly DayImage)
- Fields: storyTeaId, url (Cloudinary URL), publicId (for management), order (default 0), createdAt
- Relations: story (StoryTea)
- Index: [storyTeaId, order] for efficient ordered gallery queries
- Cascade delete: if StoryTea is deleted, all images are deleted
- Uploaded by assigned user or admin
- Multiple images per StoryTea supported

### BONUS P1 Models (Phase 2.2 - Commented in schema)

#### TeaGuess Model
- Stores user attempts to guess tea names
- Fields: userId, dayId, guessedName, timestamp, points
- Relations: user (User), day (Day)
- Points are calculated immediately upon guess submission (using scoring algorithm)
- Points are revealed to users at 21:00 UTC daily
- Only the last guess per user/day is used for scoring (query by timestamp DESC)
- Index: [userId, dayId, timestamp] for efficient last guess queries
- No `isLatest` flag - simpler to query by timestamp

### Production Models (Phase 3.2 - Commented in schema)

#### Badge Model
- Achievement definitions
- Fields: name, description, icon (Cloudinary URL or emoji)
- Relations: users (UserBadge[]) - many-to-many
- Unique constraint: name
- Examples: "First Blood" (first correct guess), "Tea Master" (highest score), etc.

#### UserBadge Model
- Junction table for User ↔ Badge many-to-many relation
- Fields: userId, badgeId, earnedAt
- Relations: user (User), badge (Badge)
- Unique constraint: [userId, badgeId] - prevents duplicate badge awards
- Cascade delete: if User or Badge is deleted, relation is deleted

## Development Workflow

### Git & GitHub Workflow
**Branching Strategy:**
- **main:** Production branch (Netlify deploys from here)
- **develop:** Active development branch (work happens here)
- **No feature branches:** Commit directly to develop for speed

**Commit Convention:**
- **Format:** `<type>: <description>`
- **Issue numbers:** If the commit is associated with a tracked issue, append the issue reference as ` (#issue-number)`; include the issue number for any commit that resolves, implements, or is intended to be tracked by an issue.
- **Max length:** 72 characters (strict)
- **Body:** Avoid unless absolutely essential (details go in code/PR/issue)
- **Types:** feat, fix, test, refactor, chore, docs

```bash
# Good examples (concise, max 72 chars)
feat: implement user registration (#7)
fix: correct UTC timezone handling (#18)
test: add scoring algorithm tests (#30)
refactor: simplify teaDay page structure (#17)
chore: update environment variables (#1)
docs: add deployment instructions

# If body is essential (rare cases):
feat: implement Prisma schema (#2)

Add User, Day, StoryTea, TeaGuess, Badge models
```

**Deploy Workflow:**
```bash
# Daily work on develop
git checkout develop
git pull origin develop
# Work on issue (TDD: test → code → refactor)
git add .
git commit -m "feat: implement login page (#8)"
git push origin develop

# Deploy to production (end of milestone or stable feature set)
gh pr create --base main --head develop --title "chore: MVP milestone release"
# Merge PR → Netlify autodeploy
```

**GitHub Projects:**
- Track all 45 issues in Project #17 "AdvienTea Calendar"
- Update issue status as you work (Todo → In Progress → Done)
- Close issues in commit messages: `Closes #8`
- 3 Milestones: MVP (Nov 18), BONUS P1 (Nov 23), Production (Nov 26)

### Code Development Workflow
1. **Pick issue from GitHub Project** (follow phase order)
2. **TDD cycle:**
   - Write failing tests (red)
   - Implement feature (green)
   - Refactor code (clean)
3. **Commit with issue number**
4. **Push to develop** (Netlify preview if configured)
5. **Move issue to Done** in GitHub Project
6. **Repeat for next issue**
7. **PR to main** when milestone complete

### Feature Implementation Workflow
1. Plan component hierarchy and agent boundaries
2. Define types/interfaces
3. Write tests first (TDD)
4. Implement server logic and data fetching
5. Build UI with daisyUI/Tailwind
6. Add client interactivity as needed
7. Add error/loading states
8. Optimize and secure
9. Commit and push

## References
- See `.github/copilot-instructions.md` for full standards
- See `README.md` for project setup and scripts
- See GitHub Project #17 for issue tracking: https://github.com/users/CarlosCanet/projects/17
