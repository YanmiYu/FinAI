# Financial Asset QA System

A full-stack LLM-powered financial QA system. Ask questions about US stocks and get real-time price data, trend analysis, and AI-generated summaries — with full traceability and zero hallucinated numbers.

## Architecture

```
Frontend (React + Vite, port 8080)
        ↓  proxy /api/query
Backend API (Express, port 3001)
        ↓
Query Router (rule-based + LLM fallback)
   ├── Market Pipeline  → Finnhub quote + candles
   └── Analysis Pipeline → Finnhub quote + news → LLM reasoning
        ↓
Structured JSON Response (v1 contract)
```

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io) (for the frontend)
- A [Finnhub](https://finnhub.io/dashboard) free API key
- (Optional) An OpenAI API key for LLM summaries
- Firebase project with Firestore (for knowledge-base RAG)

## Setup

**1. Install backend dependencies** (from the project root):

```bash
npm install
```

**2. Configure environment variables:**

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

```
FINNHUB_API_KEY=your_finnhub_key_here
OPENAI_API_KEY=your_openai_key_here   # optional — fallback summary used if absent
FIREBASE_SERVICE_ACCOUNT_JSON={...}   # required for RAG KB retrieval/seed
```

For Firebase Admin credentials, you can use either:
- `FIREBASE_SERVICE_ACCOUNT_JSON` (single JSON string), or
- `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

**3. Seed the financial glossary into Firestore (one-time):**

```bash
npm run rag:seed
```

This writes starter terms into collection: `financial_knowledge_base`.
You can add more terms later by adding docs to this same collection.
**4. Install frontend dependencies:**

```bash
cd frontend
pnpm install
cd ..
```

## Running

You need **two terminals** running simultaneously.

**Terminal 1 — Backend** (port 3001):

```bash
npm run server:dev
```

You should see:
```
[nodemon] starting `tsx api/server.ts`
[dotenv] injecting env (8) from .env
Server ready on port 3001
```

**Terminal 2 — Frontend** (port 8080):

```bash
cd frontend
pnpm dev
```

Then open **http://localhost:8080** in your browser.

## Example queries

| Query | Pipeline |
|---|---|
| `What is the price of AAPL?` | market |
| `$TSLA 7 day trend` | market |
| `Why did NVDA go up today?` | analysis (+ news) |
| `What is P/E ratio?` | knowledge |

## Available scripts

| Command | Description |
|---|---|
| `npm run server:dev` | Start backend with hot-reload (nodemon) |
| `npm run test` | Run backend unit tests |
| `npm run check` | TypeScript type check (backend + shared) |
| `npm run rag:seed` | Seed Firestore `financial_knowledge_base` |
| `cd frontend && pnpm dev` | Start frontend dev server |
| `cd frontend && pnpm typecheck` | TypeScript type check (frontend) |

## API

**POST** `http://localhost:3001/api/query`

```json
{ "query": "What is the price of AAPL?" }
```

Returns a structured `v1` JSON response with `query_type`, `asset`, `summary`, `key_metrics`, `chart_data`, `news`, `sources`, `confidence`, and a `trace` of every pipeline step.

See `plan.md` and `shared/queryContract.ts` for the full contract.
# FinAI
