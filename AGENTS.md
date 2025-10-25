# AGENTS.md

> **Note:** All project documentation is maintained in English for consistency, collaboration, and better integration with AI tools and international development standards.

## Overview

This project is an Advent Tea Calendar built with Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v4, and daisyUI 5.1.23. It features a database-driven tea calendar with time-based progressive content reveal, story narratives, and optional YouTube media integration. The project is structured for modern, scalable web development with a focus on server components, performance, and maintainability.

## Agent Roles & Responsibilities

### 1. UI/UX Agent
- Implements user interfaces using daisyUI v5 and Tailwind CSS v4
- Ensures responsive, accessible, and visually consistent components
- Follows the design system and color variables defined in `globals.css`
- Uses Geist fonts and applies font variables in layouts

### 2. Server Component Agent
- Builds server components by default ("use client" only when needed)
- Handles data fetching, static optimization, and error boundaries
- Implements API routes and server logic in `src/app/api/`
- Ensures security (input validation, authentication, CSRF, etc.)

### 3. Client Component Agent
- Adds interactivity with React hooks and client-side state
- Implements loading and error states using Suspense and `loading.tsx`/`error.tsx`
- Keeps state close to where it is used

### 4. TypeScript Agent
- Defines clear interfaces and types for all data and props
- Uses strict mode and type guards
- Considers Zod for runtime validation of external data

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
- Implements authentication and rate limiting in API routes
- Follows best practices for secure HTTP methods and data handling

### 8. Database Agent
- Manages Prisma schema and migrations
- Implements data models for tea calendar (Day, StoryTea)
- Handles database queries in Server Components
- Ensures data integrity with proper relations and constraints
- Uses SQLite for development (configurable for production)

### 9. Media Integration Agent
- Handles YouTube embed integration for ambient music/videos
- Implements responsive media players
- Manages conditional rendering based on `onlyMusic` flag
- Optimizes media loading and playback performance

### 10. Testing Agent
- Writes and maintains unit and integration tests using Jest and React Testing Library.
- Ensures new features have adequate test coverage.
- Runs tests via the `npm run test` command.
- Mocks dependencies and services as needed.

## Agent Collaboration
- Agents communicate via clear TypeScript interfaces and props
- Shared logic and types are placed in common modules
- All agents follow the standards in `.github/copilot-instructions.md`

## File Structure Reference
```
src/app/
  globals.css
  layout.tsx
  page.tsx
  teaDay/[day]/        # Dynamic routes for calendar days
    page.tsx           # Tea day detail with time-based reveals
  api/
  (feature groups)/
prisma/
  schema.prisma        # Database schema (Day, StoryTea models)
  migrations/          # Database migrations
src/generated/prisma/  # Generated Prisma Client
public/
  (static assets)
.env                   # Environment variables (gitignored)
```

## Database Schema

### Day Model
- Represents a single day in the tea advent calendar
- Fields: dayNumber, name, time, hasTheine, canReinfuse, reinfuseNumber, moreIndications, addMilk
- One-to-one relation with StoryTea

### StoryTea Model
- Contains narrative content for each tea day
- Fields: storyPart1, storyPart2, storyPart3 (progressive reveal based on time)
- Optional YouTube integration (youtubeURL, onlyMusic flag)
- Cascade delete/update with parent Day

## Development Workflow
1. Plan component hierarchy and agent boundaries
2. Define types/interfaces
3. Implement server logic and data fetching
4. Build UI with daisyUI/Tailwind
5. Add client interactivity as needed
6. Add error/loading states
7. Optimize and secure

## References
- See `.github/copilot-instructions.md` for full standards
- See `README.md` for project setup and scripts
