---
description: 'Adviente - Next.js 15 + Tailwind CSS v4 + daisyUI 5 development standards'
applyTo: '**/*.tsx, **/*.ts, **/*.jsx, **/*.js, **/*.css'
---

# Copilot Instructions for Adviente

## Project Architecture

This is a Next.js 15.5.4 project using the App Router pattern with TypeScript, featuring a modern CSS stack with Tailwind CSS v4 and daisyUI 5.1.23 components.

**Key Stack:**
- Next.js 15.5.4 with App Router (`src/app/` structure)
- React 19.1.0 with TypeScript 5
- Tailwind CSS v4.1.13 + daisyUI 5.1.23
- Turbopack for development and builds
- Geist fonts (Sans & Mono) from Next.js font optimization

## Development Workflows

### Build & Dev Commands
```bash
npm run dev    # Uses --turbopack flag for faster development
npm run build  # Production build with --turbopack
npm run start  # Production server
npm run lint   # ESLint with Next.js config
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

### Data Fetching & Performance
- Direct database queries in Server Components
- Use React Suspense for loading states with fallback UI
- Implement proper error handling and retry logic
- Image optimization with `next/image` component is standard
- Font optimization handled in `layout.tsx` with variable CSS approach
- Route prefetching for better navigation performance

### Security Considerations
- Input validation and sanitization for user data
- Proper authentication checks in middleware or route handlers
- CSRF protection for forms and API routes
- Rate limiting implementation for API endpoints
- Secure API route handling with proper HTTP methods

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
