// Package cache wraps Redis to provide AST parse result caching for the analyzer.
// Cache key: "flakeshield:analysis:{repo_id}:{commit_sha}:{file_path_hash}"
// TTL: 24 hours (results are commit-pinned, so they never go stale within a PR lifecycle)
package cache

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	keyPrefix  = "flakeshield:analysis"
	defaultTTL = 24 * time.Hour
)

// CachedResult is the serializable form stored in Redis.
type CachedResult struct {
	JobID          string      `json:"job_id"`
	FilePath       string      `json:"file_path"`
	Findings       interface{} `json:"findings"`
	FlakinessScore float64     `json:"flakiness_score"`
	ParseTimeMs    int64       `json:"parse_time_ms"`
	CachedAt       time.Time   `json:"cached_at"`
}

// Cache provides get/set operations backed by Redis.
type Cache struct {
	client *redis.Client
	ttl    time.Duration
}

// New creates a Cache connected to the given Redis URL.
// redisURL format: "redis://[:password@]host[:port][/db]"
func New(redisURL string) (*Cache, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return &Cache{client: client, ttl: defaultTTL}, nil
}

// Get retrieves a cached analysis result. Returns (nil, nil) on a cache miss.
func (c *Cache) Get(ctx context.Context, repoID, commitSHA, filePath string) (*CachedResult, error) {
	key := cacheKey(repoID, commitSHA, filePath)

	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // cache miss
	}
	if err != nil {
		return nil, fmt.Errorf("redis GET failed: %w", err)
	}

	var result CachedResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to deserialize cached result: %w", err)
	}

	return &result, nil
}

// Set stores an analysis result in Redis with the default TTL.
func (c *Cache) Set(ctx context.Context, repoID, commitSHA, filePath string, result *CachedResult) error {
	key := cacheKey(repoID, commitSHA, filePath)

	result.CachedAt = time.Now().UTC()

	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to serialize result: %w", err)
	}

	if err := c.client.Set(ctx, key, data, c.ttl).Err(); err != nil {
		return fmt.Errorf("redis SET failed: %w", err)
	}

	return nil
}

// Delete removes a cached result (e.g. if a commit is amended).
func (c *Cache) Delete(ctx context.Context, repoID, commitSHA, filePath string) error {
	key := cacheKey(repoID, commitSHA, filePath)
	return c.client.Del(ctx, key).Err()
}

// Ping checks Redis connectivity.
func (c *Cache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// Close closes the Redis connection.
func (c *Cache) Close() error {
	return c.client.Close()
}

// cacheKey builds a deterministic Redis key from repo, commit, and file path.
// The file path is hashed to avoid key length issues with deeply nested paths.
func cacheKey(repoID, commitSHA, filePath string) string {
	pathHash := fmt.Sprintf("%x", sha256.Sum256([]byte(filePath)))[:16]
	return fmt.Sprintf("%s:%s:%s:%s", keyPrefix, repoID, commitSHA[:min(7, len(commitSHA))], pathHash)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
