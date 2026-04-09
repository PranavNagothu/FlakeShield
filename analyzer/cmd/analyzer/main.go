package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"

	"github.com/PranavNagothu/FlakeShield/analyzer/internal/cache"
	"github.com/PranavNagothu/FlakeShield/analyzer/internal/detectors"
	"github.com/PranavNagothu/FlakeShield/analyzer/internal/parser"
	"github.com/PranavNagothu/FlakeShield/analyzer/internal/scorer"
)

const version = "0.1.0"

func main() {
	// ── Logger ────────────────────────────────────────────────────────────────
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	log.Info().Str("version", version).Msg("FlakeShield Analyzer starting")

	// ── Config from env ───────────────────────────────────────────────────────
	grpcPort := getEnv("GRPC_PORT", "50051")
	httpPort := getEnv("HTTP_PORT", "8001")
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379/0")

	// ── Redis cache (optional — analyzer works without it) ────────────────────
	var analysisCache *cache.Cache
	c, err := cache.New(redisURL)
	if err != nil {
		log.Warn().Err(err).Msg("Redis unavailable — running without cache")
	} else {
		analysisCache = c
		log.Info().Str("url", redisURL).Msg("Redis cache connected")
		defer analysisCache.Close()
	}

	// ── HTTP server (health + REST analyze endpoint) ───────────────────────────
	srv := newHTTPServer(httpPort, analysisCache)
	go func() {
		log.Info().Str("port", httpPort).Msg("HTTP server listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("HTTP server failed")
		}
	}()

	// ── gRPC server ───────────────────────────────────────────────────────────
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatal().Err(err).Str("port", grpcPort).Msg("Failed to bind gRPC port")
	}

	grpcSrv := grpc.NewServer(
		grpc.UnaryInterceptor(loggingInterceptor),
	)

	// TODO Phase 2b: register generated proto service once protoc runs in CI
	// pb.RegisterAnalyzerServiceServer(grpcSrv, &analyzerServer{cache: analysisCache})

	log.Info().Str("port", grpcPort).Msg("gRPC server listening")
	if err := grpcSrv.Serve(lis); err != nil {
		log.Fatal().Err(err).Msg("gRPC server failed")
	}
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

func newHTTPServer(port string, c *cache.Cache) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/analyze", handleAnalyze(c))
	return &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "flakeshield-analyzer",
		"version": version,
	})
}

// AnalyzeRequest is the HTTP REST body for POST /analyze.
type AnalyzeRequest struct {
	RepoID    string `json:"repo_id"`
	CommitSHA string `json:"commit_sha"`
	FilePath  string `json:"file_path"`
	Language  string `json:"language"`
	Content   string `json:"content"`
}

// AnalyzeResponse is the HTTP REST response for POST /analyze.
type AnalyzeResponse struct {
	JobID          string              `json:"job_id"`
	FilePath       string              `json:"file_path"`
	Findings       []detectors.Finding `json:"findings"`
	FlakinessScore float64             `json:"flakiness_score"`
	RiskLabel      string              `json:"risk_label"`
	ParseTimeMs    int64               `json:"parse_time_ms"`
	CacheHit       bool                `json:"cache_hit"`
}

func handleAnalyze(c *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req AnalyzeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON body: "+err.Error(), http.StatusBadRequest)
			return
		}

		if req.Content == "" {
			http.Error(w, "content is required", http.StatusBadRequest)
			return
		}
		if req.Language == "" {
			req.Language = "python" // default
		}

		start := time.Now()

		// ── Cache lookup ──────────────────────────────────────────────────────
		if c != nil && req.RepoID != "" && req.CommitSHA != "" {
			cached, err := c.Get(r.Context(), req.RepoID, req.CommitSHA, req.FilePath)
			if err == nil && cached != nil {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Cache", "HIT")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"job_id":          cached.JobID,
					"file_path":       cached.FilePath,
					"findings":        cached.Findings,
					"flakiness_score": cached.FlakinessScore,
					"parse_time_ms":   cached.ParseTimeMs,
					"cache_hit":       true,
				})
				return
			}
		}

		// ── Parse ─────────────────────────────────────────────────────────────
		p := parser.New()
		defer p.Close()

		result, err := p.Parse(r.Context(), parser.Language(req.Language), []byte(req.Content))
		if err != nil {
			http.Error(w, "parse error: "+err.Error(), http.StatusUnprocessableEntity)
			return
		}

		// ── Run all detectors ─────────────────────────────────────────────────
		allDetectors := []detectors.Detector{
			&detectors.AsyncDetector{},
			&detectors.TimeoutDetector{},
			&detectors.SharedStateDetector{},
			&detectors.OrderDependencyDetector{},
		}

		var allFindings []detectors.Finding
		for _, det := range allDetectors {
			findings := det.Analyze(result.Root, result.Source)
			allFindings = append(allFindings, findings...)
		}

		parseMs := time.Since(start).Milliseconds()
		score := scorer.Score(allFindings)
		jobID := fmt.Sprintf("job_%d", time.Now().UnixNano())

		resp := AnalyzeResponse{
			JobID:          jobID,
			FilePath:       req.FilePath,
			Findings:       allFindings,
			FlakinessScore: score,
			RiskLabel:      scorer.RiskLabel(score),
			ParseTimeMs:    parseMs,
			CacheHit:       false,
		}

		// ── Cache store ───────────────────────────────────────────────────────
		if c != nil && req.RepoID != "" && req.CommitSHA != "" {
			_ = c.Set(r.Context(), req.RepoID, req.CommitSHA, req.FilePath, &cache.CachedResult{
				JobID:          jobID,
				FilePath:       req.FilePath,
				Findings:       allFindings,
				FlakinessScore: score,
				ParseTimeMs:    parseMs,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "MISS")
		w.Header().Set("X-Parse-Time-Ms", fmt.Sprintf("%d", parseMs))
		json.NewEncoder(w).Encode(resp)

		log.Info().
			Str("file", req.FilePath).
			Str("lang", req.Language).
			Int("findings", len(allFindings)).
			Float64("score", score).
			Int64("parse_ms", parseMs).
			Msg("analysis complete")
	}
}

// loggingInterceptor is a simple gRPC unary interceptor that logs all calls.
func loggingInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	start := time.Now()
	resp, err := handler(ctx, req)
	log.Info().
		Str("method", info.FullMethod).
		Int64("duration_ms", time.Since(start).Milliseconds()).
		Err(err).
		Msg("gRPC call")
	return resp, err
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
