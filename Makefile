# FlakeShield Makefile
# Usage: make <target>

.PHONY: help dev down build test lint clean proto fmt check

DOCKER_COMPOSE = docker compose
GO_CMD = cd analyzer && go
PY_CMD = cd control-plane && python
NPM_CMD = cd dashboard && npm

# ── Default ───────────────────────────────────────────────────────────────────
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Local Development ─────────────────────────────────────────────────────────
dev: ## Start all services locally via docker-compose
	@echo "🚀 Starting FlakeShield local stack..."
	$(DOCKER_COMPOSE) up --build

dev-bg: ## Start all services in the background
	$(DOCKER_COMPOSE) up --build -d

down: ## Stop all services
	$(DOCKER_COMPOSE) down

down-volumes: ## Stop all services and remove volumes (WARNING: deletes data)
	$(DOCKER_COMPOSE) down -v

logs: ## Tail logs from all services
	$(DOCKER_COMPOSE) logs -f

logs-analyzer: ## Tail analyzer logs only
	$(DOCKER_COMPOSE) logs -f analyzer

logs-api: ## Tail control-plane logs only
	$(DOCKER_COMPOSE) logs -f control-plane

# ── Build ─────────────────────────────────────────────────────────────────────
build: build-analyzer build-dashboard ## Build all services

build-analyzer: ## Build Go analyzer binary
	@echo "🔨 Building Go analyzer..."
	$(GO_CMD) build -o ../bin/analyzer ./cmd/analyzer

build-dashboard: ## Build Next.js dashboard
	@echo "🔨 Building Next.js dashboard..."
	$(NPM_CMD) run build

# ── Testing ───────────────────────────────────────────────────────────────────
test: test-analyzer test-api ## Run all tests

test-analyzer: ## Run Go analyzer unit tests
	@echo "🧪 Running Go tests..."
	$(GO_CMD) test ./... -v -race -count=1

test-api: ## Run FastAPI tests
	@echo "🧪 Running Python tests..."
	cd control-plane && pytest tests/ -v --cov=app --cov-report=term-missing

test-analyzer-coverage: ## Run Go tests with coverage report
	$(GO_CMD) test ./... -coverprofile=coverage.out && go tool cover -html=coverage.out

# ── Linting ───────────────────────────────────────────────────────────────────
lint: lint-analyzer lint-api lint-dashboard ## Lint all services

lint-analyzer: ## Lint Go code
	cd analyzer && golangci-lint run ./...

lint-api: ## Lint Python code
	cd control-plane && ruff check . && mypy app/

lint-dashboard: ## Lint TypeScript code
	$(NPM_CMD) run lint

fmt: ## Format all code
	cd analyzer && gofmt -w .
	cd control-plane && black . && isort .
	$(NPM_CMD) run fmt

# ── Protobuf ─────────────────────────────────────────────────────────────────
proto: ## Generate gRPC code from proto files
	@echo "⚙️  Generating gRPC stubs..."
	protoc --go_out=./analyzer --go-grpc_out=./analyzer \
		--python_out=./control-plane/app --grpc_python_out=./control-plane/app \
		-I ./analyzer/proto \
		./analyzer/proto/analyzer.proto

# ── Database ──────────────────────────────────────────────────────────────────
db-migrate: ## Run Alembic migrations
	cd control-plane && alembic upgrade head

db-rollback: ## Roll back last migration
	cd control-plane && alembic downgrade -1

db-revision: ## Create a new migration (usage: make db-revision MSG="add findings table")
	cd control-plane && alembic revision --autogenerate -m "$(MSG)"

db-shell: ## Open psql shell
	$(DOCKER_COMPOSE) exec postgres psql -U flakeshield -d flakeshield

redis-shell: ## Open Redis CLI
	$(DOCKER_COMPOSE) exec redis redis-cli

# ── Setup ─────────────────────────────────────────────────────────────────────
setup: ## First-time setup: copy .env.example, install deps
	@echo "⚙️  Setting up FlakeShield..."
	cp -n .env.example .env || true
	cd control-plane && pip install -r requirements.txt
	$(NPM_CMD) install
	@echo "✅ Setup complete. Edit .env with your values, then run: make dev"

clean: ## Remove build artifacts
	rm -rf bin/ analyzer/coverage.out
	$(NPM_CMD) run clean 2>/dev/null || true
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# ── Check ─────────────────────────────────────────────────────────────────────
check: lint test ## Run lint + test (CI equivalent)
	@echo "✅ All checks passed"
