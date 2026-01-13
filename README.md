# Adviente - Tea Advent Calendar 🍵

![GitHub deployments](https://img.shields.io/github/deployments/CarlosCanet/advientea/production?logo=vercel&label=vercel) ![Static Badge](https://img.shields.io/badge/project-real-orange)


A gamified advent calendar web application for tea lovers, built with Next.js 16, featuring daily challenges, user authentication, and a ranking system. This app is designed for the community participating in this special event.

[Try the app](https://adviente.vercel.app) | [Bug report](https://github.com/CarlosCanet/advientea/issues)

## 🎯 Project Overview

Each accepted participant is responsible for curating their assigned day, updating tea information, and setting the daily atmosphere. A logistical coordinator (affectionately known as the **Execu-TEA-ve**) assigns days and manages the distribution of physical tea packs to all participants beforehand.

On the designated days (typically early December), the cycle unfolds as follows:
- **Morning**: Essential brewing instructions and initial mood setting.
- **Noon & Afternoon**: Enhanced atmosphere (music, photos, stories) is revealed.
- **Evening**: The tea's identity and purchase details are finally unveiled.

Participants can also play **Adivina*Té*** (Guess the Tea). Registered users earn points by guessing any or all of the following: tea name, ingredients, type, and/or the contributor. You can guess just one field or all of them. Points for each correct guess are calculated immediately and stored, and revealed at the same time as tea name but if you only guess the contributor the points remain hidden until the final revelation day.

### ✨ Features

- 🔐 **Secure Authentication**: User registration, login, and password recovery with BetterAuth
- 📅 **Interactive Calendar**: Grid-based advent calendar with daily tea reveals
- 🎮 **Gamification**: Guess tea info daily and earn points based on accuracy and timing
- 🏆 **Ranking System**: Daily and overall leaderboards with highlighted top 3 users
- 📖 **Story Content**: Progressive narrative reveals with optional YouTube media
- 🖼️ **Image Management**: Cloudinary integration for avatars and tea day images
- 👥 **User Roles**: Admin (full system access), Execu-TEA-ve (curate all teas and stories), and User (assigned to one specific day)
- ✅ **Test-Driven Development**: Vitest + React Testing Library

### 🗄️ Database Schema

- **User**: Authentication, profile, assigned day
- **Day**: Tea information (name, infusion time, properties)
- **TeaIngredient**: Ingredients associated with a Tea
- **StoryTea**: Narrative content with progressive reveals
- **TeaGuess**: User guesses with calculated points
- **StoryImage**: Multiple images per tea day story
- **Badge** *(Future)*: Achievement definitions
- **UserBadge** *(Future)*: User-badge assignments

### ↕️ Key Workflows

#### Daily Reveal Cycle (19:00 UTC)
- Tea name, ingredients, and type are revealed
- If a user only guesses the contributor, points remain hidden until final day
- Daily ranking is updated
- Contributor identity remains hidden until final day
- Overall ranking is shown after final day

#### Tea Guessing Game
1. **What you can guess** (any combination):
   - Tea name
   - Ingredients
   - Tea type
   - Contributor (who proposed this tea)

2. **Scoring**:
   - Submit guesses anytime before reveal time
   - Points calculated immediately using string similarity algorithm
   - Only your **last guess** for each field counts

## 🛠️ Tech Stack & Decisions

This project uses cutting-edge technologies to explore modern web development patterns and evaluate their production-readiness:

![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwind-css&logoColor=white) ![daisyUI](https://img.shields.io/badge/daisyUI-FFC63A?style=for-the-badge&logo=daisyui&logoColor=black) ![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white) ![BetterAuth](https://img.shields.io/badge/BetterAuth-FFFFFF?style=for-the-badge&logo=betterauth&logoColor=black) ![Resend](https://img.shields.io/badge/resend-000000?style=for-the-badge&logo=resend&logoColor=white) ![Cloudinary](https://img.shields.io/badge/cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white) ![Vitest](https://img.shields.io/badge/Vitest-729B1B?style=for-the-badge&logo=vitest&logoColor=white)

### Core Framework Choices

**Next.js 16** (App Router)
- Native server actions for type-safe mutations without API routes
- Async dynamic params (`await params`) for cleaner route handling
- Turbopack stability for faster dev/build cycles

**Tailwind CSS v4 + daisyUI 5**
- New `@import` and `@plugin` syntax for simplified configuration
- Inline theme definitions for better maintainability
- Component-first approach with daisyUI reducing custom CSS by ~60%

**BetterAuth** over NextAuth
- Type-safe auth with zero config boilerplate
- Built-in Prisma adapter with proper TypeScript inference
- Simpler session management for this use case (no OAuth complexity needed)

**Vitest** over Jest
- Resolved Jest compatibility issues with Prisma in integration tests (ESM/CommonJS mismatch)
- Native ESM support eliminates transform configuration overhead
- Faster test execution in watch mode
- Better TypeScript integration out-of-the-box

### Trade-offs Accepted
- **Benefits**: Modern DX, performance improvements, cleaner codebase  
- **Risks**: Limited community resources, potential breaking changes  
- **Mitigation**: Comprehensive test coverage (TDD), detailed documentation, MCP integration for AI-assisted documentation

### Learning Outcomes
- Mastered Next.js 16 async patterns and Server Component best practices
- Evaluated Tailwind v4 migration path (worth it for new projects)
- Proved BetterAuth viability for production auth flows
- Developed workflows for managing bleeding-edge dependencies safely

## 🏗️ Architecture & Design Principles

The code adheres to high-quality software engineering standards to ensure maintainability, scalability, and code health:

- **SOLID Principles**: Ensuring modular and testable component architecture.
- **KISS & DRY**: Keeping logic simple and avoiding duplication, especially in server actions and services.
- **Clean Code**: Meaningful naming conventions, small functions, and self-documenting code.
- **TDD (Test-Driven Development)**: Writing tests before implementation to guide design and ensure reliability.
- **Mobile-First**: Designing UI/UX priorities for mobile devices using Tailwind's responsive utilities.

## 🤖 AI-Assisted Development

This project leverages modern AI tools to enhance productivity and code quality:

- **AI Agents**: Specialized roles defined in `AGENTS.md` (e.g., UI Agent, Database Agent, Testing Agent) to handle specific domains.
- **MCP (Model Context Protocol)**: Integration with external tools (GitHub, Sentry, Documentation) to provide rich context to the AI assistant.
- **GitHub Copilot**: Used for code generation, refactoring, and following the strict guidelines defined in `.github/copilot-instructions.md`.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.17 or later
- pnpm (recommended) or npm/yarn/bun

### Installation

1. Clone the repository
```bash
git clone https://github.com/CarlosCanet/advientea.git
cd advientea
```

2. Install dependencies
```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` and add your credentials.

4. Set up the database
```bash
# Using pnpm
pnpm dlx prisma generate
pnpm dlx prisma migrate dev --name init

# Or using npx
npx prisma generate
npx prisma migrate dev --name init
```

5. Run the development server
```bash
# Using pnpm
pnpm dev

# Or using npm
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Scripts

```bash
npm run dev       # Start development server with Turbopack
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
npm run test      # Run tests with Vitest
npx prisma studio # Open Prisma Studio (DB GUI)
```

## 📃 Documentation

### Technical Documentation
- **[AGENTS.md](./AGENTS.md)** - Agent roles and responsibilities for AI development
- **[copilot-instructions.md](./.github/copilot-instructions.md)** - Coding standards and patterns
- **[daisyUI Instructions](./.github/instructions/daisyui.instructions.md)** - UI component guidelines
