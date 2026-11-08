# Apex Quiz

Full-stack AI quiz platform: a React + Vite frontend, a FastAPI backend, Gemini-powered
quiz generation, Firebase auth/leaderboards, and Paystack premium subscriptions.

The frontend and backend deploy together as **one Vercel project**: a single FastAPI
function serves the API and the built Vite frontend.

## Features

- **Tiered Access**: Free (5-10 questions) vs Premium (up to 50 questions)
- **JWT Authentication**: Secure token-based auth with subscription status in claims
- **Paystack Subscriptions**: Hosted checkout, server-side verification, and
  webhook-free reconciliation
- **PDF Processing**: Multi-strategy extraction (pdfplumber → PyMuPDF → pdfminer → Gemini Vision)
- **AI Structuring**: Gemini Flash structures raw PDF content into validated question blocks
- **LangGraph Workflow**: Generation with validation, reflection, and retry (max 2 retries)
- **Gamification**: XP, levels, streaks, daily challenges, achievements, leaderboards
- **Caching**: Redis caching of structured PDF content (1-hour TTL); optional in production
- **Rate Limiting**: Configurable per-user/IP rate limiting

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, Zustand, Firebase Auth/Firestore |
| Backend | FastAPI, SQLModel, SQLAlchemy, Pydantic v2 |
| Database | SQLite (local dev) / PostgreSQL (production) |
| Auth | JWT (HS256) with bcrypt password hashing |
| AI | Google Gemini via REST/httpx |
| Orchestration | LangGraph |
| PDF | pdfplumber, PyMuPDF, pdfminer.six |
| Cache | Redis (async, optional) |
| Payments | Paystack |
| Hosting | Vercel (FastAPI function + CDN-served Vite build) |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Redis (optional; caching fails open without it)
- Google Gemini API key ([get one here](https://makersuite.google.com/app/apikey))
- Paystack account with a payment plan
- Firebase project (Auth + Firestore)

### 1. Backend

```bash
# Clone and navigate
cd Apex-Quiz

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install runtime + development dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Configure environment
cp .env.example .env
# Edit .env: GEMINI_API_KEY, SECRET_KEY, PAYSTACK_*, DATABASE_URL

# Run development server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
npm install
npm run dev
```

Vite serves the app at `http://localhost:5175` and proxies API calls to
`VITE_BACKEND_URL` (defaults to `http://localhost:8000` in development).

### With Docker

```bash
docker-compose up --build
```

## Environment Variables

Copy `.env.example` to `.env` and fill in local values. Never commit `.env`.

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./apex_quiz.db` | SQLAlchemy URL. Use PostgreSQL in production |
| `SECRET_KEY` | dev placeholder | **Required in production**; long random string |
| `DEBUG` | `false` | Enables `/docs` and verbose SQL |
| `ENVIRONMENT` | `development` | `production` on Vercel |
| `CORS_ORIGINS` | localhost origins | JSON array of allowed frontend origins |
| `GEMINI_API_KEY` | - | **Required** Google Gemini API key |
| `GEMINI_FLASH_MODEL` | `gemini-3.6-flash` | Primary generation model |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.8-flash,gemini-3.5-flash` | Failover models |
| `PAYSTACK_SECRET_KEY` | - | Paystack secret key (server only) |
| `PAYSTACK_PUBLIC_KEY` | - | Paystack public key (safe for client config) |
| `PAYSTACK_PLAN_CODE` | - | Payment plan code (`PLN_...`) |
| `PAYSTACK_CURRENCY` | `USD` | Plan currency, e.g. `NGN` |
| `PAYSTACK_AMOUNT` | `499` | Amount in the smallest unit; the plan price takes precedence |
| `PAYSTACK_CALLBACK_URL` | `http://localhost:5175/payment/callback` | Frontend callback route |
| `REDIS_URL` | `redis://localhost:6379/0` | Optional cache |
| `PDF_MAX_MB` | `20` | Max PDF upload size (see Vercel limits below) |
| `FREE_QUESTION_MAX` | `10` | Max questions for free tier |
| `PREMIUM_QUESTION_MAX` | `50` | Max questions for premium tier |
| `STRUCTURE_QUALITY_THRESHOLD` | `0.6` | Minimum extraction quality |
| `STUDY_AID_CHUNK_SIZE` | `12000` | Characters per source chunk |
| `STUDY_AID_CHUNK_OVERLAP` | `400` | Overlap between chunks |
| `STUDY_AID_MAX_CHUNKS` | `8` | Maximum chunks per document |
| `STUDY_AID_CONCURRENCY` | `3` | Parallel chunk generations |

### Frontend (build-time)

Vite only exposes variables prefixed with `VITE_`.

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender id |
| `VITE_FIREBASE_APP_ID` | Firebase app id |
| `VITE_BACKEND_URL` | Backend origin. Omit on Vercel for same-origin `/api` calls |

## Paystack Setup

1. Create a payment plan in **Paystack Dashboard → Products → Payment Plans**.
2. Copy the plan code (`PLN_...`), secret key (`sk_...`), and set them in `.env`:
   - `PAYSTACK_SECRET_KEY`
   - `PAYSTACK_PLAN_CODE`
   - `PAYSTACK_CURRENCY` and `PAYSTACK_AMOUNT` (amount in the smallest unit; the plan's price overrides this).
3. Set `PAYSTACK_CALLBACK_URL` to `<frontend-origin>/payment/callback`, and make sure
   every frontend origin is listed in `CORS_ORIGINS` (JSON array).
4. *(Optional)* Add a webhook in **Settings → API Keys & Webhooks** pointing to
   `<backend-origin>/api/auth/paystack/webhook` with the `charge.success`,
   `subscription.create`, `subscription.disable`, and `subscription.not_renew` events.
   The app also works without a webhook: the callback page verifies the transaction,
   and `GET /api/auth/subscription` reconciles pending payments and lapsed periods
   directly with Paystack.

Clicking **Upgrade to Premium** creates a Paystack transaction and redirects the
browser to the hosted checkout. The callback page verifies the reference server-side
before unlocking premium.

## Vercel Deployment

The project is configured to deploy as a single Vercel project:

- `npm run build` produces the Vite frontend in `dist/`.
- Vercel detects the FastAPI app in `app/main.py`.
- `app.frontend("/", directory="dist")` serves the built SPA, while all API routes
  continue to be handled by FastAPI. Vercel promotes the frontend assets to its CDN.
- One function handles `/api/*`; the frontend calls it on the same origin.

### 1. Create a production database

Vercel functions have an ephemeral, read-only filesystem. Do **not** use SQLite in
production. Create a PostgreSQL database (Vercel Postgres, Neon, Supabase, etc.) and
set `DATABASE_URL`, for example:

```text
postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

The backend converts `postgres://` / `postgresql://` to the async `asyncpg` driver and
normalizes `sslmode` for asyncpg.

### 2. Add environment variables in Vercel

In **Project Settings → Environment Variables**, add every backend variable you need
for Production (and Preview if desired). At minimum:

```text
DATABASE_URL
SECRET_KEY
GEMINI_API_KEY
PAYSTACK_SECRET_KEY
PAYSTACK_PLAN_CODE
PAYSTACK_CURRENCY=NGN
PAYSTACK_AMOUNT=943700
PAYSTACK_CALLBACK_URL=https://<your-domain>/payment/callback
CORS_ORIGINS=["https://<your-domain>"]
DEBUG=false
ENVIRONMENT=production
```

Add the `VITE_FIREBASE_*` variables as well; they are baked into the frontend at
build time. Do **not** set `VITE_BACKEND_URL` when the frontend and API share the
same Vercel domain.

### 3. Deploy

Using the Vercel CLI:

```bash
npx vercel --prod
```

Or connect the GitHub repository in the Vercel dashboard and let every push to
`main` deploy. `vercel.json` sets the frontend build command and function limits.

### 4. Post-deploy checklist

- Open `https://<your-domain>/api/health` and confirm `200`.
- Add the Vercel domain to **Firebase Console → Authentication → Settings →
  Authorized domains** so Google/email sign-in works.
- Update the Paystack dashboard callback/webhook URLs to the deployed domain if you
  use webhooks.
- Test the subscription flow with a Paystack test key before switching to live keys.
- Keep `PAYSTACK_CURRENCY` and `PAYSTACK_AMOUNT` aligned with the live plan.

### Vercel limits

- Request/response body limit: **4.5 MB**. Keep `PDF_MAX_MB` at or below this for
  uploads made through the deployed function, or upload directly to storage.
- Function duration: configured in `vercel.json` (`maxDuration: 60`).
- Filesystem: use PostgreSQL, not SQLite. `/tmp` is ephemeral and per-instance.

## Security

- `.env` is gitignored. Commit `.env.example` only, with placeholders.
- Keep `PAYSTACK_SECRET_KEY`, `SECRET_KEY`, and `GEMINI_API_KEY` in Vercel
  environment variables, never in source.
- Rotate any key that has been shared in chat, logs, or a public repository.
- Paystack webhooks are verified with the `x-paystack-signature` HMAC-SHA512 header.
- Firebase web config (`VITE_FIREBASE_*`) is public by design; protect data with
  Firestore Security Rules (`npm run deploy:rules`).
- Never commit Firebase service-account JSON. `seed.js` reads it from
  `FIREBASE_SERVICE_ACCOUNT_PATH` at runtime.

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (OAuth2 password flow) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user info |
| GET | `/api/auth/subscription` | Get subscription status (reconciles with Paystack) |
| GET | `/api/auth/upgrade/plan` | Get the configured Paystack plan (price/currency/interval) |
| POST | `/api/auth/upgrade` | Initialize a Paystack checkout and return the authorization URL |
| GET | `/api/auth/upgrade/verify?reference=...` | Verify a payment and activate premium |
| POST | `/api/auth/cancel` | Disable the Paystack subscription |
| POST | `/api/auth/paystack/webhook` | Paystack webhook (signature verified) |

### Quiz Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/quiz/generate` | Generate quiz from PDF (multipart) |
| POST | `/api/quiz/generate/text` | Generate quiz from text |
| GET | `/api/quiz/history` | Get user's quiz history |
| GET | `/api/quiz/{quiz_id}` | Get specific quiz |
| DELETE | `/api/quiz/{quiz_id}` | Delete a quiz |

### Study Aid Generation (Grounded Flashcards + Quizzes)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/study-aids/generate` | Generate grounded flashcards + quizzes from text |
| POST | `/api/study-aids/generate/pdf` | Generate grounded flashcards + quizzes from a PDF |
| GET | `/api/study-aids/history` | List the user's generated study sets |
| GET | `/api/study-aids/{study_set_id}` | Get a full study set |
| DELETE | `/api/study-aids/{study_set_id}` | Delete a study set |

Every item carries a `source_reference` copied from the source. The server verifies each reference (exact, punctuation-insensitive, then 90% token overlap) and drops items that cannot be grounded. Identical requests are cached per user by a hash of the source plus counts/difficulty/topics, so repeats return `cached: true` without calling Gemini.

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Basic health check |
| GET | `/api/health/ready` | Readiness with dependency checks |

## Usage Examples

### Generate Quiz from PDF

```bash
curl -X POST "http://localhost:8000/api/quiz/generate" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@document.pdf" \
  -F "question_count=10" \
  -F "difficulty=medium" \
  -F "topics=biology,chemistry" \
  -F "question_types=multiple_choice,true_false"
```

### Generate Quiz from Text

```bash
curl -X POST "http://localhost:8000/api/quiz/generate/text" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your educational content here...",
    "question_count": 5,
    "difficulty": "easy"
  }'
```

### Generate Study Aids from Text

```bash
curl -X POST "http://localhost:8000/api/study-aids/generate" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_text": "Photosynthesis is the process by which green plants convert light energy into chemical energy...",
    "num_flashcards": 5,
    "num_quizzes": 5,
    "difficulty": "medium",
    "topics": ["photosynthesis", "chlorophyll"]
  }'
```

## PDF Processing Pipeline

```
Upload (≤20MB)
    ↓
Validate (type, size, corruption)
    ↓
Extract Strategy Chain:
  1. pdfplumber (tables) → 2. PyMuPDF (text) → 3. pdfminer → 4. Gemini Vision (scanned)
    ↓
Gemini Flash: "Structure this raw text into QuestionBlock[] JSON"
    ↓
Pydantic Validation + Quality Score (≥0.6 threshold)
    ↓
Cache structured result (Redis, key=hash(pdf), TTL=1hr)
    ↓
LangGraph: Select → Generate → Validate → (Retry x2) → Finalize
    ↓
Return QuizResponse
```

## Study Aid Pipeline (NotebookLM-style)

```
Source text or PDF
    ↓
Sliding-window chunking (12k chars, 400 overlap, max 8 chunks, concurrency 3)
    ↓
Gemini JSON mode + Master Studio Prompt (grounding, atomicity, distractor engineering)
    ↓
Pydantic validation + JSON salvage (malformed items skipped, batch never fails)
    ↓
Grounding verification (exact → punctuation-insensitive → 90% token overlap)
    ↓
Dedupe + allocation + trim to requested counts
    ↓
Persist StudySet (per-user cache key = hash(source + counts + difficulty + topics))
```

## Project Structure

```
app/
├── api/routes/       # API endpoints (auth, quiz, study aids, health)
├── auth/             # JWT auth & dependencies
├── config/           # Settings management
├── graphs/           # LangGraph workflows
├── middleware/       # Rate limiting, logging, errors
├── models/           # SQLModel database models & session
├── schemas/          # Pydantic schemas
├── services/         # PDF, Gemini, cache, Paystack, subscriptions
└── main.py           # FastAPI app factory
src/
├── components/       # UI components
├── pages/            # Route pages (including PaymentCallbackPage)
├── services/         # Backend client, Firebase, quiz engine
├── store/            # Zustand stores
└── utils/            # XP, progression, daily challenge, categories
tests/                # Backend pytest suite
```

## Testing

```bash
# Backend
pytest -v

# Backend with coverage
pytest --cov=app --cov-report=html

# Frontend
npm run test
npm run lint
npm run build
```

## Deployment Notes

### Vercel / Serverless

- Single FastAPI function; frontend static assets are served from Vercel's CDN.
- Keep request bodies under 4.5 MB.
- Use PostgreSQL with connection pooling (`pool_pre_ping`, small pool).
- Redis is optional; the app fails open when it is unavailable.
- Set `DEBUG=false` and a strong `SECRET_KEY`.

### Traditional production

- PostgreSQL with asyncpg
- Redis for caching and rate limits
- Reverse proxy / load balancer
- Monitor Gemini API quota and latency

## License

MIT
