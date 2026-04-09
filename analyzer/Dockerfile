FROM golang:1.22-alpine AS builder

RUN apk add --no-cache gcc musl-dev git build-base

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o /analyzer ./cmd/analyzer

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM alpine:3.19
RUN apk add --no-cache ca-certificates curl

WORKDIR /app
COPY --from=builder /analyzer .

EXPOSE 50051 8001

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["./analyzer"]
