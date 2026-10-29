# Apex Quiz API

AI-powered quiz generation from PDFs and text using Google Gemini, FastAPI, and LangGraph.

## Features

- **Tiered Access**: Free (5-10 questions) vs Premium (up to 50 questions)
- **JWT Authentication**: Secure token-based auth with subscription status in claims
- **PDF Processing**: Multi-strategy extraction (pdfplumber → PyMuPDF → pdfminer → Gemini Vision)
- **AI Structuring**: Gemini Flash structures raw PDF content into validated question blocks
- **LangGraph Workflow**: Generation with validation, reflection, and retry (max 2 retries)
- **Caching**: Redis caching of structured PDF content (1-hour TTL)
- **Rate Limiting**: Configurable per-user/IP rate limiting

## Tech Stack

- **Framework**: FastAPI (Python 3.11+)
- **Database**: SQLModel + SQLite (dev) / PostgreSQL (prod)
- **Auth**: JWT (HS256) with bcrypt password hashing
- **AI**: Google Gemini 3.8 Flash (verified live; 1.5/2.x retired by Google)
- **Orchestration**: LangGraph (stateful DAG)
- **PDF**: pdfplumber, PyMuPDF, pdfminer.six
- **Cache**: Redis (async)
- **Validation**: Pydantic v2

## Quick Start

### Prerequisites

- Python 3.11+
- Redis (for caching)
- Google Gemini API key ([get one here](https://makersuite.google.com/app/apikey))

### Installation

```bash
# Clone and navigate
cd Apex-Quiz

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (especially GEMINI_API_KEY)

# Run development server
uvicorn app.main:app --reload
```

### With Docker

```bash
# Build and run with docker-compose
docker-compose up --build
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (OAuth2 password flow) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user info |
| GET | `/api/auth/subscription` | Get subscription status |
| POST | `/api/auth/cancel` | Cancel the Paystack subscription |

### Paystack Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/paystack/plan` | Public plan price/interval (no secret key) |
| POST | `/api/payments/paystack/initialize` | Start a card-only recurring checkout |
| POST | `/api/payments/paystack/verify` | Verify a transaction server-side |
| POST | `/api/payments/paystack/webhook` | Paystack webhook receiver (signature verified) |

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

## Paystack Subscriptions

Premium uses a **predefined Paystack Plan**. Create the plan once, then set its
code as `PAYSTACK_PREMIUM_PLAN_CODE`; checkout requests only reference
`plan: "PLN_..."` so clients can never change the price.

### 1. Create the plan

```bash
curl https://api.paystack.co/plan \
  -H "Authorization: Bearer $PAYSTACK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Apex Quiz Premium",
    "interval": "monthly",
    "amount": 500000,
    "currency": "NGN"
  }'
```

`amount` is in the lowest currency subunit: 5,000 NGN = **500,000 kobo**. The
backend derives the checkout amount the same way (`PAYSTACK_PREMIUM_PRICE × 100`),
so you do not pass amounts from the browser. Keep `PAYSTACK_PREMIUM_PRICE` and
`PAYSTACK_PREMIUM_INTERVAL` in sync with the Paystack plan; a mismatch fails
closed during verification rather than granting access for the wrong amount.

### 2. Configure the backend

```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_PREMIUM_PLAN_CODE=PLN_...
PAYSTACK_PREMIUM_PRICE=5000        # base currency, converted to kobo/cents
PAYSTACK_CURRENCY=NGN
PAYSTACK_PREMIUM_INTERVAL=monthly
PAYSTACK_CALLBACK_URL=http://localhost:5175/payment/callback
```

### 3. Add the webhook

In the Paystack dashboard, set the webhook URL to:

```text
https://<your-api-host>/api/payments/paystack/webhook
```

Paystack signs the raw request body with your secret key. The endpoint verifies
`x-paystack-signature` as HMAC-SHA512 before parsing anything, and records each
event in a unique idempotency ledger so retries cannot double-provision access.

| Event | Action |
|-------|--------|
| `charge.success` | Activates premium after a successful card charge |
| `subscription.create` | Stores the subscription code, renewal date, and server-only email token |
| `invoice.payment_failed` | Flags the renewal as past due and revokes premium access |
| `subscription.disable` | Revokes access when Paystack disables a subscription |

### Security notes

- **Card only:** initialization sends `channels: ["card"]` because Paystack
  automated recurring charges are card-driven. Non-card charges are ignored.
- **Plan first:** the request body only accepts `{ "plan": "premium" }`; plan
  codes and amounts are resolved server-side.
- **Never trust the frontend callback:** the popup callback calls
  `/verify`, which also asks Paystack directly. The webhook remains the source
  of truth for renewals and failures.
- **No offline upgrade fallback:** if the backend or Paystack is unavailable,
  the checkout fails safely rather than granting local premium.

The React app opens the Paystack Inline popup when available and falls back to
redirecting to `authorization_url`; `/payment/callback` verifies the returned
`reference` before showing success.

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

## Configuration

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `FREE_QUESTION_MAX` | 10 | Max questions for free tier |
| `PREMIUM_QUESTION_MAX` | 50 | Max questions for premium tier |
| `PAYSTACK_SECRET_KEY` | - | **Required for payments** Paystack secret key |
| `PAYSTACK_PUBLIC_KEY` | - | Paystack public key used by the checkout popup |
| `PAYSTACK_PREMIUM_PLAN_CODE` | - | Paystack plan code (`PLN_...`) for recurring billing |
| `PAYSTACK_PREMIUM_PRICE` | 5000 | Base plan price; converted to kobo/cents |
| `PAYSTACK_CURRENCY` | NGN | Plan currency (NGN, USD, ZAR, GHS, KES) |
| `PAYSTACK_PREMIUM_INTERVAL` | monthly | Must match the interval on the Paystack plan |
| `PAYSTACK_CALLBACK_URL` | http://localhost:5175/payment/callback | Redirect fallback after checkout |
| `PDF_MAX_MB` | 20 | Max PDF upload size |
| `STRUCTURE_QUALITY_THRESHOLD` | 0.6 | Minimum extraction quality |
| `GEMINI_API_KEY` | - | **Required** Google Gemini API key |
| `GEMINI_FLASH_MODEL` | gemini-3.6-flash | Primary generation model |
| `GEMINI_FALLBACK_MODELS` | gemini-3.8-flash,gemini-3.5-flash | Failover models (comma-separated) |
| `GEMINI_REQUEST_TIMEOUT` | 25 | Per-model timeout in seconds |
| `STUDY_AID_CHUNK_SIZE` | 12000 | Characters per source chunk |
| `STUDY_AID_CHUNK_OVERLAP` | 400 | Overlap between chunks |
| `STUDY_AID_MAX_CHUNKS` | 8 | Maximum chunks per document |
| `STUDY_AID_CONCURRENCY` | 3 | Parallel chunk generations |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection string |
| `CACHE_TTL_SECONDS` | 3600 | Cache TTL for structured PDFs |

## Project Structure

```
app/
├── api/routes/       # API endpoints
├── auth/             # JWT auth & dependencies
├── config/           # Settings management
├── graphs/           # LangGraph workflows
├── middleware/       # Custom middleware
├── models/           # SQLModel database models
├── schemas/          # Pydantic schemas
├── services/         # Business logic (PDF, Gemini, Cache)
└── main.py           # FastAPI app factory
```

## Testing

```bash
# Run tests
pytest -v

# With coverage
pytest --cov=app --cov-report=html
```

## Deployment Notes

### Vercel/Serverless
- Single worker (`UVICORN_WORKERS=1`)
- 30s request timeout
- Use connection pooling for DB
- Cache structured PDFs to reduce cold-start latency

### Production
- PostgreSQL with asyncpg
- Redis cluster for caching
- Load balancer with sticky sessions (for WebSocket if added)
- Monitor Gemini API quota and latency
- Set `DEBUG=false`, configure proper `SECRET_KEY`

## License

MIT