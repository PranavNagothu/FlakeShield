<div align="center">

# 🛡️ FlakeShield

### Write-Time Flaky Test Prevention Platform

[![CI](https://github.com/PranavNagothu/FlakeShield/actions/workflows/ci.yml/badge.svg)](https://github.com/PranavNagothu/FlakeShield/actions/workflows/ci.yml)
[![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go)](https://go.dev)
[![Python FastAPI](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org)
[![Claude AI](https://img.shields.io/badge/AI-Claude_3.5_Sonnet-D97757?logo=anthropic)](https://anthropic.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io)

**The only platform that catches flaky tests at write-time — before they ever reach CI.**

[Architecture](#architecture) · [Quick Start](#quick-start) · [Tech Stack](#tech-stack)

</div>

---

## 🚀 The Problem & Solution

**150,000+ developer hours are wasted annually on flaky tests** (Atlassian Research, 2024).

Every existing tool — Trunk, DeFlaker, iDFlakies, FlakyGuard — detects or repairs flakiness **after tests have already failed** in CI. This is the wrong point of intervention. It wastes CI minutes and developer context.

**FlakeShield** intercepts code the moment it's written or a PR is opened. It statically analyzes test code for root causes of flakiness, and provides an **AI-generated fix patch** instantly. 

### Key Features
- ⚡ **Sub-millisecond AST Parsing**: Powered by Go and Tree-sitter.
- 🤖 **AI Patch Generation**: Uses Claude 3.5 Sonnet to automatically fix detected flakiness patterns.
- 📊 **Real-time Dashboard**: Beautiful Next.js interface with real-time analytics and an interactive Playground.
- 🛡️ **4 Core Flakiness Detectors**: Unguarded Async, Shared Mutable State, Hardcoded Timeouts, and Order-dependent states.

---

## 🏗️ Architecture

FlakeShield uses a modern, distributed microservices architecture designed for high throughput and extensibility.

```mermaid
graph TD
    UI[Next.js Dashboard UI] <--> |REST / WebSocket| API[FastAPI Control Plane]
    Playground[Interactive Playground] --> |Direct POST| Analyzer[Go Static Analysis Engine]
    API <--> |gRPC| Analyzer
    API <--> DB[(PostgreSQL 16)]
    API <--> Cache[(Redis 7)]
    API <--> Claude[Claude 3.5 Sonnet API]
    
    Analyzer --> TS[Tree-sitter AST Parser]
    TS --> D1[Async Detector]
    TS --> D2[State Detector]
    TS --> D3[Timeout Detector]
```

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Static Analysis Engine** | Go 1.22, Tree-sitter, gRPC |
| **Control Plane API** | Python 3.12, FastAPI, SQLAlchemy (Async), Alembic, Pydantic |
| **AI Patch Generator** | Anthropic API (Claude 3.5 Sonnet) |
| **Database & Cache** | PostgreSQL 16 (pgvector), Redis 7 |
| **Frontend Dashboard** | Next.js 15 (App Router), TypeScript, Recharts, Tailwind CSS (Glassmorphism UI) |
| **Infrastructure / CI** | Docker Compose, GitHub Actions |

---

## 🔍 Flakiness Detection Rules

| Rule ID | Category | Description | Example |
|---|---|---|---|
| `ASYNC001` | Unguarded Async | `async` function called without `await` or proper synchronization | Missing `await` on coroutine |
| `STATE001` | Shared Mutable State | Module-level mutable variable modified across tests | `_cache = {}` at module scope |
| `TIMEOUT001` | Hardcoded Timeout | Literal sleep/wait value instead of dynamic polling | `time.sleep(5)` |
| `TIMEOUT002` | No Retry / Timeout | Network/IO call with no timeout parameter | `requests.get(url)` |
| `ORDER001` | Test Ordering | Test depends on side effects from previous test | Missing `setUp`/`tearDown` cleanup |

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Go 1.22+
- Python 3.12+ (uv or standard venv)
- Node.js 20+

### 1. Start Infrastructure
We use Docker for PostgreSQL and Redis.
```bash
docker compose up -d postgres redis
```

### 2. Start the Control Plane (FastAPI)
```bash
cd control-plane
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL="postgresql+asyncpg://flakeshield:changeme@localhost:5433/flakeshield" \
REDIS_URL="redis://localhost:6380/0" \
uvicorn app.main:app --port 8000 --reload
```

### 3. Start the Static Analyzer (Go)
```bash
cd analyzer
go run cmd/analyzer/main.go
```

### 4. Start the Dashboard (Next.js)
```bash
cd dashboard
npm install
npm run dev
```

### 5. Access the Platform
- **Dashboard & Playground**: [http://localhost:3000](http://localhost:3000)
- **API Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Analyzer REST API**: [http://localhost:8001](http://localhost:8001)

---

## 🤖 AI Patch Configuration

By default, the platform runs in **Mock AI Mode**, generating deterministic unified diffs without requiring an API key. 

To enable the real **Claude 3.5 Sonnet** integration:
1. Export your Anthropic key to the Control Plane environment:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   export AI_PATCH_MOCK="false"
   ```
2. Restart the FastAPI server. The *Playground* will now use actual LLM reasoning to resolve flakiness.

---

<div align="center">
Built to eliminate flaky tests before they waste a single CI minute.
</div>
