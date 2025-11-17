# Adviente - Tea Advent Calendar 🍵

A gamified advent calendar web application for tea lovers, built with Next.js 15, featuring daily challenges, user authentication, and a ranking system.

## Features

- 🔐 **Secure Authentication**: User registration, login, and password recovery with BetterAuth
- 📅 **Interactive Calendar**: Grid-based advent calendar with daily tea reveals
- 🎮 **Gamification**: Guess tea names daily and earn points based on accuracy and timing
- 🏆 **Ranking System**: Daily and overall leaderboards with highlighted top 3 users
- 🎖️ **Achievement Badges**: Special badges for accomplishments (first guess, popular tea, etc.)
- 📖 **Story Content**: Progressive narrative reveals with optional YouTube media
- 🖼️ **Image Management**: Cloudinary integration for avatars and tea day images
- 👥 **User Roles**: Admin (full access) and User (assigned to one specific day)
- ✅ **Test-Driven Development**: Jest + React Testing Library

## Tech Stack

- **Framework**: Next.js 15.5.4 (App Router)
- **UI**: React 19.1.0 + TypeScript 5
- **Styling**: Tailwind CSS v4.1.13 + daisyUI 5.1.23
- **Database**: Prisma ORM + SQLite (development)
- **Auth**: BetterAuth + bcryptjs
- **Email**: Resend
- **Images**: Cloudinary
- **Testing**: Jest + React Testing Library
- **Build**: Turbopack

## Getting Started

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

Edit `.env` and add your credentials:
```env
DATABASE_URL="file:./dev.db"
BETTER_AUTH_SECRET="your-secret-key"
RESEND_API_KEY="your-resend-key"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

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

## Project Structure

```
src/app/
├── (auth)/               # Authentication pages
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── profile/              # User profile with badges
├── calendar/             # Calendar grid view
├── teaDay/[day]/         # Individual tea day pages
├── ranking/              # Daily and overall rankings
├── admin/                # Admin dashboard
│   ├── days/             # Manage tea days
│   └── users/            # User management
├── api/                  # API routes
│   ├── auth/             # BetterAuth endpoints
│   ├── guess/            # Tea name guessing
│   └── upload/           # Image uploads
└── lib/                  # Utilities and configuration
    ├── auth.ts           # BetterAuth setup
    ├── cloudinary.ts     # Cloudinary config
    ├── scoring.ts        # Points calculation
    └── constants.ts      # App constants
```

## Scripts

```bash
npm run dev       # Start development server with Turbopack
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
npm run test      # Run tests with Jest
npx prisma studio # Open Prisma Studio (DB GUI)
```

## Database Schema

- **User**: Authentication, profile, assigned day
- **Day**: Tea information (name, infusion time, properties)
- **StoryTea**: Narrative content with progressive reveals
- **TeaGuess**: User guesses with calculated points
- **Badge**: Achievement definitions
- **UserBadge**: User-badge assignments
- **DayImage**: Multiple images per tea day

## Key Workflows

### Daily Reveal Cycle
- Each day at **21:00 UTC**, the tea name is revealed
- User points become visible
- Daily ranking is updated
- Overall ranking is recalculated
- Badges are awarded automatically

### Tea Guessing
1. Users submit guesses throughout the day
2. Points are calculated immediately (string similarity algorithm)
3. Points remain hidden until 21:00 UTC
4. Only the **last guess** per user/day counts for scoring

## Documentation

### Technical Documentation
- **[AGENTS.md](./AGENTS.md)** - Agent roles and responsibilities for AI development
- **[copilot-instructions.md](./.github/copilot-instructions.md)** - Coding standards and patterns
- **[daisyUI Instructions](./.github/instructions/daisyui.instructions.md)** - UI component guidelines

## Contributing

This project follows Test-Driven Development (TDD). Please write tests for new features and ensure all tests pass before submitting PRs.

---
