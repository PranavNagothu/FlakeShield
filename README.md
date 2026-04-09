<div align="center">

# 🛡️ FlakeShield

### Write-Time Flaky Test Prevention Platform

[![CI](https://github.com/PranavNagothu/FlakeShield/actions/workflows/ci.yml/badge.svg)](https://github.com/PranavNagothu/FlakeShield/actions/workflows/ci.yml)
[![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go)](https://go.dev)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io)
[![AWS](https://img.shields.io/badge/AWS-ECS%20%7C%20RDS%20%7C%20Lambda-FF9900?logo=amazon-aws)](https://aws.amazon.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**The only platform that catches flaky tests at write-time — before they ever reach CI.**

[Architecture](#architecture) · [Quick Start](#quick-start) · [Tech Stack](#tech-stack) · [Docs](docs/)

</div>

---

## The Problem

**150,000+ developer hours are wasted annually on flaky tests** (Atlassian Research, 2024).

Every existing tool — Trunk, DeFlaker, iDFlakies, FlakyGuard — detects or repairs flakiness **after tests have already failed** in CI. This is the wrong point of intervention.

FlakeShield intercepts every PR the moment it's opened, statically analyzes the test code for all four root causes of flakiness, and posts an AI-generated fix patch as a PR comment — all within seconds, before a single CI run is wasted.

---

## How It Works

```
Developer opens PR
       │
       ▼
GitHub App Webhook (AWS Lambda)
       │
       ▼
Go Static Analysis Engine (Tree-sitter)
  ├─ Unguarded async/await calls
  ├─ Shared mutable state
  ├─ Hardcoded timeouts (time.sleep, setTimeout)
  └─ Order-dependent setUp/tearDown
       │
       ▼
AI Patch Generator (LangChain + Claude)
       │
       ▼
PR Comment with exact fix diff posted
       │
       ▼
Dashboard updated (D3 heatmap + real-time WebSocket feed)
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          GitHub                                   │
│   PR Opened → Webhook → AWS Lambda (GitHub App Handler)          │
└─────────────────────────────┬────────────────────────────────────┘
                              │ HTTP POST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Python FastAPI Control Plane (ECS Fargate)          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Webhook API │  │ Analysis API │  │ Dashboard API (REST+WS)│  │
│  └──────┬──────┘  └──────┬───────┘  └───────────────────────┘  │
│         │                │                                        │
│         └────────────────┼──── gRPC ────────────────────────┐   │
└──────────────────────────┼──────────────────────────────────┼───┘
                           │                                   │
              ┌────────────▼───────────────────┐              │
              │   Go Static Analysis Engine     │              │
              │          (ECS Fargate)          │              │
              │  ┌──────────┐ ┌─────────────┐  │              │
              │  │Tree-sitter│ │  Detectors  │  │              │
              │  │  Parser  │ │ async/state │  │              │
              │  │          │ │timeout/order│  │              │
              │  └──────────┘ └─────────────┘  │              │
              └────────────────────────────────┘              │
                                                               │
┌──────────────────────────────────────────────────────────────┘
│                     Data Layer
│  ┌─────────────────────────────────────────────────────────┐
│  │  PostgreSQL (RDS Multi-AZ)  │  Redis (ElastiCache)      │
│  │  - repos, jobs, findings    │  - AST parse cache        │
│  │  - team/RBAC                │  - rate limiting          │
│  │  - test_history             │  - WebSocket pub/sub      │
│  │  - pgvector embeddings      │                           │
│  └─────────────────────────────────────────────────────────┘
│
│  ┌──────────────────┐  ┌──────────────────────────────────┐
│  │  AWS S3          │  │  Observability                   │
│  │  Analysis reports│  │  OpenTelemetry → Grafana         │
│  │  → Glacier/90d   │  │  Prometheus → CloudWatch         │
│  └──────────────────┘  └──────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Static Analysis** | Go 1.22, Tree-sitter, go-tree-sitter |
| **API & Orchestration** | Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic |
| **Auth** | JWT (HS256), RBAC middleware |
| **Database** | PostgreSQL 16, pgvector |
| **Cache & Pub/Sub** | Redis 7 |
| **AI / Patch Gen** | LangChain, Claude (Anthropic), PyTorch, SHAP |
| **Frontend** | Next.js 14, TypeScript, D3.js, Recharts, Tailwind CSS |
| **Infrastructure** | AWS ECS Fargate, RDS Multi-AZ, ElastiCache, Lambda, S3, ECR |
| **IaC** | Terraform |
| **Observability** | OpenTelemetry, Prometheus, Grafana, CloudWatch, PagerDuty |
| **Security** | mTLS, AWS Secrets Manager, GitHub App OAuth |
| **CI/CD** | GitHub Actions, Docker, ECR image scanning (Trivy) |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Go 1.22+
- Python 3.12+
- Node.js 20+
- `make`

### 1. Clone & configure

```bash
git clone https://github.com/PranavNagothu/FlakeShield.git
cd FlakeShield
make setup          # copies .env.example → .env, installs deps
```

Edit `.env` with your values (GitHub App credentials, Claude API key, etc.)

### 2. Start the full stack

```bash
make dev            # starts postgres, redis, analyzer, control-plane, dashboard
```

Services available:
| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| Control Plane API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Analyzer REST | http://localhost:8001 |

### 3. Run a test analysis

```bash
# Analyze a Python test file for flaky patterns
curl -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d '{"language": "python", "content": "import time\n\ndef test_api():\n    time.sleep(5)\n    assert get_status() == 200"}'
```

### 4. Run tests

```bash
make test           # runs all Go + Python tests
make test-analyzer  # Go tests only
make test-api       # Python tests only
```

---

## Project Structure

```
FlakeShield/
├── analyzer/          # Go — Tree-sitter static analysis engine (gRPC + REST)
├── control-plane/     # Python FastAPI — REST API, job orchestration, auth
├── webhook/           # Go — GitHub App Lambda handler
├── dashboard/         # Next.js — real-time developer dashboard
├── ml/                # Python — PyTorch classifier + LangChain patch gen
├── infra/             # Terraform — all AWS infrastructure
├── docker/            # Dockerfiles and init scripts
├── .github/workflows/ # CI (lint+test) and CD (build+push ECR)
└── docs/              # Architecture diagrams, runbooks, ADRs
```

---

## Flakiness Detection Rules

| Rule ID | Category | Description | Example |
|---|---|---|---|
| `ASYNC001` | Unguarded Async | `async` function called without `await` or proper synchronization | Missing `await` on coroutine |
| `ASYNC002` | Race Condition | Goroutine/thread accessing shared state without mutex | `go func()` touching shared map |
| `STATE001` | Shared Mutable State | Module-level mutable variable modified across tests | `_cache = {}` at module scope |
| `STATE002` | Test Ordering | Test depends on side effects from previous test | Missing `setUp`/`tearDown` cleanup |
| `TIMEOUT001` | Hardcoded Timeout | Literal sleep/wait value instead of dynamic polling | `time.sleep(5)` |
| `TIMEOUT002` | No Retry Logic | Network/IO call with no retry or backoff | `requests.get(url)` in CI |
| `ORDER001` | Setup Dependency | Test imports state initialized outside fixture | Global DB connection |
| `ORDER002` | Teardown Missing | Resource allocated in test with no cleanup | `open(file)` without context manager |

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Built with ❤️ to eliminate flaky tests before they waste a single CI minute.

</div>
