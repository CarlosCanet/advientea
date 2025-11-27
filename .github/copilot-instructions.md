---
description: 'Adviente - Next.js 16 + Tailwind CSS v4 + daisyUI 5 development standards'
applyTo: '**/*.tsx, **/*.ts, **/*.jsx, **/*.js, **/*.css'
---

# Copilot Instructions for Adviente

## Project Architecture

This is a Next.js 16.0 project using the App Router pattern with TypeScript, featuring a modern CSS stack with Tailwind CSS v4 and daisyUI 5.1.23 components.

**Project Type:** Advent Tea Calendar with gamification, user authentication, and daily challenges.

**Key Stack:**
- Next.js 16.0 with App Router (`src/app/` structure)
- React 19.2 with TypeScript 5
- Tailwind CSS v4.1.13+ + daisyUI 5.3.9+
- Turbopack for development and builds (stable in v16)
- Geist fonts (Sans & Mono) from Next.js font optimization
- Prisma ORM with PostgreSQL (development)
- BetterAuth for authentication
- Resend for email delivery
- Cloudinary for image management
- bcryptjs for password hashing
- fastest-levenshtein for string similarity scoring
- Jest + React Testing Library for TDD

**Critical Next.js 16 Changes:**
- ⚠️ Dynamic route params are now async: `const { id } = await params`
- ✅ Server Actions are stable and recommended for forms
- ✅ Turbopack is production-ready

## Development Workflows

### Build & Dev Commands
```bash
npm run dev    # Uses --turbopack flag for faster development
npm run build  # Production build with --turbopack
npm run start  # Production server
npm run lint   # ESLint with Next.js config
npm run test   # Run tests with Jest
```

**Critical:** This project uses Turbopack by default - always include `--turbopack` flag in build commands.

## CSS & Styling Conventions

### Tailwind CSS v4 Syntax
The project uses **Tailwind CSS v4** with new syntax in `globals.css`:
```css
@import "tailwindcss";        /* New v4 import syntax */
@plugin "daisyui";           /* New v4 plugin syntax */
@theme inline { ... }        /* New v4 theme definition */
```

**Important:** Use daisyUI component classes following the v5 conventions as defined in `.github/instructions/daisyui.instructions.md`.

### Color System
Custom CSS variables are integrated with Tailwind:
- `--background` / `--foreground` for theme-aware colors
- Dark mode support via `prefers-color-scheme`
- Font variables: `--font-geist-sans`, `--font-geist-mono`

### Component Patterns
- Use daisyUI component classes (e.g., `btn`, `card`, `modal`) as primary styling approach
- Combine with Tailwind utilities for customization: `btn px-10`
- Use `!` suffix for CSS specificity override when needed: `btn bg-red-500!`

## File Structure Patterns

```
src/app/
├── layout.tsx        # Root layout with font optimization
├── page.tsx          # Home page component
├── globals.css       # Global styles with Tailwind v4 setup
└── favicon.ico       # App icon
```

**Layout Requirements:**
- Always include Geist font variables in className: `${geistSans.variable} ${geistMono.variable}`
- Root layout handles global font loading and CSS imports

## Development Standards & Architecture

### App Router Architecture
- Use Server Components by default (add "use client" only when necessary)
- Group routes by feature/domain in `src/app/` structure
- Implement proper error boundaries with `error.tsx` files
- Leverage static optimization where possible
- Use `loading.tsx` for loading states

### TypeScript Best Practices
- Strict mode enabled with Next.js TypeScript config
- Define clear interfaces and types for props and data
- Use `Metadata` type for page metadata exports
- Component props use `Readonly<{}>` pattern for children
- Implement proper error handling with type guards
- Consider Zod for runtime type validation when handling external data

### State Management Patterns
- React Server Components for server state and data fetching
- React hooks (useState, useReducer) for client-side state
- Implement proper loading and error states
- Use optimistic updates where appropriate
- Keep state as close to components that need it as possible

### Testing
- The project uses Jest for unit and integration testing.
- Run tests using the `npm run test` command.
- Write tests for new components and logic to ensure they are working as expected.
- Use React Testing Library for testing components.

### Data Fetching & Performance
- Direct database queries in Server Components using Prisma
- Use React Suspense for loading states with fallback UI
- Implement proper error handling and retry logic
- Image optimization with `next/image` component is standard
- Font optimization handled in `layout.tsx` with variable CSS approach
- Route prefetching for better navigation performance
- Database queries should use indexes for performance (see schema)

### Database & Prisma Patterns
- Prisma Client generated to `src/generated/prisma/`
- Use `@prisma/client` imports from generated location
- Server Components can query database directly
- All database operations should handle errors gracefully
- Use transactions for multi-step operations
- Respect cascade delete/update relations defined in schema

### Authentication & Authorization
- BetterAuth handles authentication flows (registration, login, password recovery)
- Password hashing uses bcryptjs
- User roles: `admin` (full access) and `user` (restricted to assigned day)
- Protect routes with middleware checks
- Admin-only pages should verify `isAdmin` flag
- Users can only edit their assigned day's content (enforced in API routes)
- Session management handled by BetterAuth
- Password recovery emails sent via Resend

### Gamification & Business Logic
- Tea guessing: Users submit guesses, points calculated immediately but revealed at 21:00 UTC
- Scoring algorithm in `src/lib/scoring.ts` (Levenshtein distance using fastest-levenshtein)
- Points stored in `TeaGuess` model, only last guess per user/day counts
- Daily rankings reset at 21:00 UTC, overall rankings are cumulative
- Badge awarding logic triggers on specific achievements
- Reveal time constant: `REVEAL_HOUR` (in `src/lib/constants.ts`)

### Form Handling (MVP)
- Server Actions for all form submissions (native Next.js 16)
- HTML5 validation for MVP (required, email, pattern attributes)
- Progressive enhancement approach: forms work without JavaScript
- Consider adding Zod validation and react-hook-form post-MVP for enhanced UX

### Image Management
- Cloudinary for all image uploads (avatars, tea day images)
- Store Cloudinary URL in database
- Store `publicId` for image management/deletion
- Secure upload with signed URLs
- Multiple images per StoryTea supported via DayImage model

### Security Considerations
- Input validation and sanitization for user data
- Proper authentication checks in middleware or route handlers
- CSRF protection for forms and API routes
- Rate limiting implementation for API endpoints
- Secure API route handling with proper HTTP methods
- Password hashing with bcryptjs (never store plain passwords)
- Validate user permissions before allowing day edits (users can only edit their assigned day)
- Admin-only routes must check `isAdmin` flag
- Cloudinary uploads must use signed URLs
- Email tokens for password recovery must expire and be single-use

### CSS & Styling Standards
- Mobile-first responsive design with Tailwind breakpoints
- Use responsive prefixes: `sm:`, `md:`, `lg:`
- Grid/flex layouts should be responsive: `flex-col sm:flex-row`
- Maintain semantic HTML structure for accessibility
- Follow container queries best practices
- Dark mode support via CSS variables and `prefers-color-scheme`

## External Dependencies & Integration

### Key Dependencies
- **daisyUI 5.1.23**: Component library with specific v5 syntax rules
- **@tailwindcss/postcss**: Required for Tailwind v4 processing
- **eslint-config-next**: Integrated linting with TypeScript support

### Browser Support
- Target: `> 1%` (defined in package.json browserslist)
- Modern browser features available due to Next.js 15 baseline

## Development Environment Setup

### VSCode Configuration
Project includes `.vscode/settings.json` with:
- CSS lint rules configured for Tailwind v4 at-rules
- Tailwind CSS IntelliSense settings
- TypeScript/React language support

### PostCSS Configuration
Minimal setup in `postcss.config.mjs` using only `@tailwindcss/postcss` plugin for v4 compatibility.

## Implementation Process

1. **Plan component hierarchy** - Define server vs client component boundaries
2. **Define types and interfaces** - Create TypeScript definitions first
3. **Implement server-side logic** - Build Server Components and data fetching
4. **Build client components** - Add interactivity with "use client" components
5. **Add proper error handling** - Implement error boundaries and loading states
6. **Implement responsive styling** - Apply daisyUI components with Tailwind utilities
7. **Add loading states** - Use `loading.tsx` files and Suspense boundaries
8. **Optimize performance** - Check bundle size and implement code splitting

## File Structure Best Practices

```
src/app/
├── (dashboard)/          # Route groups for organization
├── api/                  # API routes
├── globals.css          # Global styles with Tailwind v4
├── layout.tsx           # Root layout with font optimization
├── loading.tsx          # Global loading UI
├── error.tsx            # Global error boundary
├── not-found.tsx        # 404 page
└── page.tsx             # Home page
```

## Deployment Considerations

- Optimized for Vercel deployment (standard Next.js pattern)
- Static assets in `/public` directory
- Production builds use Turbopack optimization
- Font optimization handled automatically by Next.js
- Bundle size optimization with proper code splitting
- Cache invalidation strategies for dynamic content

## Project-Specific Features & Pages

### Required Pages

#### Authentication Pages (`src/app/(auth)/`)
- **Registration (`/register`)**: Secure form with email, username, password validation
- **Login (`/login`)**: Email/username + password authentication
- **Password Recovery (`/forgot-password`)**: Email-based password reset flow

#### User Pages
- **Profile (`/profile`)**: 
  - View and edit user information
  - Upload avatar image (Cloudinary)
  - Display earned badges
  - Show user statistics

- **Calendar (`/calendar`)**: 
  - Grid layout showing all 25 days
  - Visual indicators for current day, past days, future days
  - Click on past days to view their content
  - Highlight user's assigned day

- **Tea Day Detail (`/teaDay/[day]`)**: 
  - Progressive story reveal (storyPart1, storyPart2, storyPart3)
  - Tea information (name revealed at 21:00 UTC, brewing instructions)
  - Guess form (input for tea name)
  - YouTube embed (if available)
  - Multiple images from Cloudinary
  - Display user's guess and points (after 21:00 UTC)

- **Rankings (`/ranking`)**: 
  - Toggle between Daily and Overall views
  - Highlight top 3 users with avatars
  - Display all users with points
  - Show badges earned
  - Real-time updates after 21:00 UTC reveals

#### Admin Pages (`src/app/admin/`)
- **Day Management (`/admin/days`)**: 
  - CRUD operations for all days
  - Edit tea information and story content
  - Upload images for any day

- **User Management (`/admin/users`)**: 
  - Assign users to specific days (one-to-one)
  - View user statistics
  - Manage user roles

### Core Workflows

#### Guessing Tea Names
1. User visits tea day page
2. Submits guess via Server Action form (multiple attempts allowed)
3. Points calculated immediately using Levenshtein distance algorithm (fastest-levenshtein)
4. Points stored but NOT displayed until 21:00 UTC
5. At 21:00 UTC: tea name revealed, points shown, rankings updated
6. Only last guess per user/day counts for scoring

#### Scoring Algorithm
- Located in `src/lib/scoring.ts`
- Levenshtein distance comparison using `fastest-levenshtein` library
- Normalized string matching (lowercase, trimmed)
- Time-based bonuses (earlier guesses may earn more)
- Points range: 0-100
- Formula: `similarity = 1 - (distance / maxLength)`, then `points = Math.round(similarity * 100)`

#### Badge System
- Badges defined in `Badge` model
- Awarded automatically based on achievements:
  - "First Blood": First correct guess of the day
  - "Tea Master": Highest total score
  - "Popular Tea": Your tea guessed by 50%+ users
  - (More to be defined)
- Displayed on user profile and rankings

#### Daily Reveal Cycle
- Constant: `REVEAL_HOUR` (in `src/lib/constants.ts`)
- At 21:00 UTC daily:
  - Tea name revealed
  - User points displayed
  - Daily ranking calculated and shown
  - Overall ranking updated
  - Badges awarded if conditions met

### Form Requirements

#### Story Content Form (User/Admin)
- Server Action form with progressive enhancement
- Fields: storyPart1, storyPart2, storyPart3, youtubeURL, onlyMusic
- HTML5 validation for required fields
- Image upload via Cloudinary (multiple images)
- Non-admin users: Only edit their assigned day
- Admins: Edit any day

#### Tea Information Form (Admin)
- Server Action form with HTML5 validation
- Fields: dayNumber, name, infusionTime, hasTheine, canReinfuse, reinfuseNumber, moreIndications, addMilk
- Validation for required fields
- Unique dayNumber constraint

### Testing Strategy (TDD)

#### Unit Tests
- Scoring algorithm logic
- String similarity functions
- Badge awarding conditions
- Date/time utilities (reveal time checks)

#### Integration Tests
- Authentication flows (register, login, password recovery)
- API routes (guess submission, image upload)
- Database operations (CRUD, relations)

#### Component Tests
- Form validation and submission
- Conditional rendering (before/after 19:00)
- User permission checks (admin vs user)
- Ranking calculations and display

## Development Workflow

For detailed Git workflow, branching strategy, and GitHub Project tracking, see [AGENTS.md](../AGENTS.md).

