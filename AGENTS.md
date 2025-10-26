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
- **TDD Approach:** Test-Driven Development using Jest and React Testing Library
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
- Uses SQLite for development (configurable for production)

### 9. Media Integration Agent
- Handles YouTube embed integration for ambient music/videos
- Implements Cloudinary integration for image uploads (avatars, tea day images)
- Manages responsive media players
- Optimizes media loading and playback performance
- Implements secure upload flows (signed URLs, public_id management)

### 10. Testing Agent
- Implements Test-Driven Development (TDD) approach
- Writes and maintains unit and integration tests using Jest and React Testing Library
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

## Agent Collaboration
- Agents communicate via clear TypeScript interfaces and props
- Shared logic and types are placed in common modules
- All agents follow the standards in `.github/copilot-instructions.md`

## File Structure Reference
```
src/app/
  (auth)/
    login/page.tsx
    register/page.tsx
    forgot-password/page.tsx
  profile/page.tsx         # User profile with avatar upload
  calendar/page.tsx        # Grid view of all days
  teaDay/[day]/
    page.tsx               # Tea day detail with story and guess form
  ranking/
    page.tsx               # Daily and overall rankings
  admin/
    days/page.tsx          # Admin: manage all days
    users/page.tsx         # Admin: assign users to days
  api/
    auth/[...]/route.ts    # BetterAuth endpoints
    guess/route.ts         # Submit tea guess
    upload/route.ts        # Cloudinary image upload
  globals.css
  layout.tsx
  page.tsx                 # Home/landing page
prisma/
  schema.prisma            # Database schema
  migrations/              # Database migrations
src/generated/prisma/      # Generated Prisma Client
src/lib/
  auth.ts                  # BetterAuth configuration
  cloudinary.ts            # Cloudinary setup
  scoring.ts               # Scoring algorithm logic
  constants.ts             # REVEAL_HOUR and other constants
public/
  (static assets)
.env                       # Environment variables (gitignored)
```

## Database Schema

### User Model
- Authentication and profile information
- Fields: username, email, password (hashed with bcryptjs), isAdmin, image (Cloudinary URL), createdAt, updatedAt
- Each non-admin user is assigned to one specific Day (one-to-one relation)
- Relations: assignedDay, guesses, badges

### Day Model
- Represents a single day in the tea advent calendar
- Fields: dayNumber, name, infusionTime (minutes), hasTheine, canReinfuse, reinfuseNumber, moreIndications, addMilk
- Relations: story (StoryTea), assignedUser, guesses (TeaGuess[])
- Reveal time is constant at 21:00 UTC (defined in src/lib/constants.ts)

### StoryTea Model
- Contains narrative content for each tea day
- Fields: storyPart1, storyPart2, storyPart3 (progressive reveal based on time)
- Optional YouTube integration (youtubeURL, onlyMusic flag)
- Relations: day (Day), images (DayImage[])
- Cascade delete/update with parent Day

### TeaGuess Model
- Stores user attempts to guess tea names
- Fields: userId, dayId, guessedName, timestamp, points
- Points are calculated immediately upon guess submission (using scoring algorithm)
- Points are revealed to users at 21:00 UTC daily
- Only the last guess per user/day is used for scoring
- Index on [userId, dayId] for performance

### Badge Model
- Achievement definitions
- Fields: name, description, icon (Cloudinary URL or emoji)
- Relations: users (UserBadge[]) - many-to-many
- Examples: "First Blood" (first correct guess), "Tea Master" (highest score), etc.

### UserBadge Model
- Junction table for User ↔ Badge many-to-many relation
- Fields: userId, badgeId, earnedAt
- Unique constraint on [userId, badgeId]

### DayImage Model
- Images for tea day stories
- Fields: storyTeaId, url (Cloudinary URL), publicId (for management), createdAt
- Uploaded by assigned user or admin
- Multiple images per StoryTea supported

## Development Workflow

### Git & GitHub Workflow
**Branching Strategy:**
- **main:** Production branch (Netlify deploys from here)
- **develop:** Active development branch (work happens here)
- **No feature branches:** Commit directly to develop for speed

**Commit Convention:**
- **Format:** `<type>: <description> (#issue-number)`
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
