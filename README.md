# Apex Quiz

Full-stack quiz application built with React, Firebase, and Tailwind CSS. Features timed quizzes across 12 categories, leaderboard rankings, Google OAuth authentication, and dark/light mode.

## Features

- **12 Quiz Categories** — General Knowledge, Science, Movies, Music, Video Games, Geography, History, Technology, Front-end Development, Back-end Development, Current Affairs, and Relationship Quiz
- **Timed Questions** — 15-second timer per question with auto-advance
- **Leaderboard** — Top 10 scores tracked via Firestore, highlights your entries
- **Authentication** — Google OAuth and email/password sign-in via Firebase Auth
- **Dark Mode** — Full theme support persisted to localStorage
- **Glassmorphism UI** — Frosted glass navbars, subtle noise texture, tactile hover effects
- **Responsive** — Mobile-first grid layout for category selection

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, Vite 8 |
| State | Zustand 5 |
| Styling | Tailwind CSS v4, MUI v6 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
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
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

## Deployment

Deploy to Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

## Project Structure

```
src/
  components/     # Reusable UI components
  pages/          # Route-level page components
  store/          # Zustand state management
  services/       # API and Firebase service layers
  theme/          # MUI theme configuration
  utils/          # Constants, categories, question bank
  hooks/          # Custom React hooks
```

## License

MIT
