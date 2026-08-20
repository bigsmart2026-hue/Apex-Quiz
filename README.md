# Apex Quiz

A premium, gamified quiz platform built with React 19, Firebase (Auth + Firestore), and Tailwind CSS v4. Timed quizzes across 12 categories with XP/levels, streaks, daily challenges, achievements, leaderboards, and head-to-head friend challenges.

## Features

### Core quiz
- **12 Quiz Categories** — General Knowledge, Science, Movies, Music, Video Games, Geography, History, Technology, Front-end Development, Back-end Development, Current Affairs, Relationship Quiz
- **Timed Questions** — 15-second timer per question with auto-advance and keyboard shortcuts (1–4 to answer, Enter to continue)
- **Question pipeline** — Open Trivia DB → local question bank → Firestore fallback
- **Detailed review** — Collapsible per-question results with correct/incorrect/not-answered states

### Gamification
- **XP & levels** — 7 tiers (Rookie → Apex); XP for correct answers, completion, perfect rounds, streak bonuses; daily challenges award 2× XP
- **Daily streaks** — Consecutive-day tracking with bonus XP (capped), persisted via date-key logic
- **Daily challenge** — One deterministic 10-question challenge per day (seeded by date), at most one completion per day (enforced server-side)
- **Achievements** — 10 unlockable badges (first victory, perfect score, speed demon, 90%+ accuracy, 5/10/25-question milestones, daily streaks, mastery, level 5) surfaced via toasts and the profile grid
- **Category mastery** — Per-category accuracy bars on the dashboard and profile
- **Leaderboards** — Global (all-time XP) and Weekly (current-week XP) tabs with top-3 podium, your rank, and error/empty states

### Friend challenges
- Create a challenge (category + 5 or 10 questions), share a 6-character code or direct link, opponent joins by code, both play the same question set, and the winner is derived from the stored immutable scores.

### Polish
- Auth-gated routing with lazy-loaded route chunks (per-page code splitting)
- Loading / error / empty states throughout; toasts for XP, level-ups and achievements
- Dark/light mode persisted to localStorage
- Accessible primitives (focus states, aria labels, keyboard nav) and mobile-first responsive layout
- Motion animations (Framer Motion) and confetti on high scores

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, Vite 8 |
| State | Zustand 5 (persist middleware) |
| Routing | React Router 7 (lazy routes) |
| Styling | Tailwind CSS v4, MUI v6 (theme fallbacks) |
| Animation | Framer Motion |
| Icons | Lucide React |
| Auth | Firebase Authentication (Google + email/password) |
| Database | Cloud Firestore (security rules enforced) |
| Testing | Vitest 4 + Testing Library |
| Fonts | DM Serif Display + Inter |

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with Authentication and Firestore enabled

### Setup

```bash
git clone https://github.com/bigsmart2026-hue/Apex-Quiz.git
cd Apex-Quiz
npm install
```

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

```bash
npm run dev          # dev server (port 5175, strict)
npm run lint         # oxlint
npm test             # vitest
npm run build        # production build
```

## Firestore Schema

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| `users` | `{uid}` | Profile: XP, level (derived), streaks, weekly XP, stats, achievements map, categoryStats |
| `quizAttempts` | `{uid}_{categoryId}_{date}` | Immutable per-quiz result; deterministic ID blocks duplicate XP farming |
| `dailyChallengeAttempts` | `{uid}_{date}` | Immutable daily-challenge completion marker (one per day) |
| `challenges` | `{code}` | Friend challenge: creator/opponent, question snapshot, immutable scores |
| `quizzes` | custom | Optional Firestore question fallback bank |

**Indexes required:** none — all leaderboard queries are single-field `orderBy` (`xp` desc, `weeklyXp` desc) with `limit`, no composite indexes needed.

### Security model (`firestore.rules`)

- `users`: readable by any authenticated user (leaderboard); create/update only by owner with **delta-bounded** writes — XP/`weeklyXp` increase by ≤ 340 per write, `quizzesCompleted` +1, answer/correct counters ≤ +10, streak within +1, achievements ≤ +2.
- `quizAttempts` / `dailyChallengeAttempts`: **create-only**, validated, owner-scoped, immutable (update/delete denied).
- `challenges`: readable by authenticated users; create by owner (`status: 'open'`); update only for joining (`open → active`) or writing your own score slot once; the questions snapshot, creator, category and total are immutable; winner is **derived from stored scores**, never accepted from the client.
- **No Cloud Functions** — the trust boundary is client-rules enforced. Residual server-side risk: a determined attacker could still grant themselves extra XP by creating fresh accounts or waiting across days; there is no per-day total cap across multiple categories. Mitigations: deterministic attempt IDs (one play per category per day), delta caps, and immutable leaderboard inputs. Documented as acceptable for this scope.

## Project Structure

```
src/
  components/       # Navbar, pages' shared components, UI primitives
  components/ui/    # Design system: Button, Card, Badge, Modal, ScoreRing, StatCard, ...
  pages/            # Route-level pages (lazy loaded)
  store/            # Zustand stores: quiz, profile, toasts
  services/         # firebase.config, firestore, trivia API, profile, leaderboard, daily challenge, challenges
  utils/            # progression, achievements, dates, challengeCode, categories, questionBank, constants
  test/             # Vitest setup
  theme/            # MUI theme configuration
```

## Testing

```bash
npm test
```

Covers: question shuffling, trivia API mapping, quiz store flow (answer scoring, completion/XP award, challenge submission, already-played handling, theme persistence), progression math (levels/XP/daily/streak caps), achievements, date utils, challenge codes, and the deterministic daily challenge.

## Deployment

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

Deploy `firestore.rules` with `firebase deploy --only firestore:rules` before first launch.

## License

MIT