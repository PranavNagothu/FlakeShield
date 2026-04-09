package detectors_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/PranavNagothu/FlakeShield/analyzer/internal/detectors"
	"github.com/PranavNagothu/FlakeShield/analyzer/internal/parser"
	"github.com/PranavNagothu/FlakeShield/analyzer/internal/scorer"
)

// analyzeWith parses Python source and runs a single detector on it.
func analyzeWith(t *testing.T, source string, det detectors.Detector) []detectors.Finding {
	t.Helper()
	p := parser.New()
	defer p.Close()
	result, err := p.Parse(context.Background(), parser.Python, []byte(source))
	require.NoError(t, err)
	return det.Analyze(result.Root, result.Source)
}

// ─── TimeoutDetector ──────────────────────────────────────────────────────────

func TestTimeoutDetector_HardcodedSleep(t *testing.T) {
	source := `
import time

def test_api_ready():
    time.sleep(5)
    assert get_status() == 200
`
	findings := analyzeWith(t, source, &detectors.TimeoutDetector{})
	require.NotEmpty(t, findings, "expected TIMEOUT001 for time.sleep(5)")
	assert.Equal(t, "TIMEOUT001", findings[0].RuleID)
	assert.Equal(t, detectors.SeverityHigh, findings[0].Severity)
	assert.Contains(t, findings[0].Snippet, "time.sleep(5)")
	assert.Greater(t, findings[0].Confidence, 0.9)
}

func TestTimeoutDetector_CleanPolling_NoFindings(t *testing.T) {
	source := `
def test_api_ready():
    poll_until_ready(timeout=10, interval=0.1)
    assert get_status() == 200
`
	findings := analyzeWith(t, source, &detectors.TimeoutDetector{})
	assert.Empty(t, findings, "polling with dynamic timeout should be clean")
}

func TestTimeoutDetector_AsyncioSleep(t *testing.T) {
	source := `
import asyncio

async def test_data_loaded():
    asyncio.sleep(2)
    assert len(get_data()) > 0
`
	findings := analyzeWith(t, source, &detectors.TimeoutDetector{})
	require.NotEmpty(t, findings)
	assert.Equal(t, "TIMEOUT001", findings[0].RuleID)
}

func TestTimeoutDetector_RequestsNoTimeout(t *testing.T) {
	source := `
import requests

def test_service_health():
    resp = requests.get("http://service/health")
    assert resp.status_code == 200
`
	findings := analyzeWith(t, source, &detectors.TimeoutDetector{})
	require.NotEmpty(t, findings, "expected TIMEOUT002 for requests.get without timeout=")
	assert.Equal(t, "TIMEOUT002", findings[0].RuleID)
	assert.Equal(t, detectors.SeverityMedium, findings[0].Severity)
}

func TestTimeoutDetector_RequestsWithTimeout_Clean(t *testing.T) {
	source := `
import requests

def test_service_health():
    resp = requests.get("http://service/health", timeout=10)
    assert resp.status_code == 200
`
	findings := analyzeWith(t, source, &detectors.TimeoutDetector{})
	assert.Empty(t, findings, "timeout= kwarg present, should be clean")
}

// ─── SharedStateDetector ──────────────────────────────────────────────────────

func TestSharedStateDetector_ModuleLevelDict(t *testing.T) {
	source := `
_cache = {}

def test_first():
    _cache["key"] = "value"

def test_second():
    assert _cache == {}
`
	findings := analyzeWith(t, source, &detectors.SharedStateDetector{})
	require.NotEmpty(t, findings, "expected STATE001 for module-level mutable dict")
	assert.Equal(t, "STATE001", findings[0].RuleID)
	assert.Equal(t, detectors.SeverityCritical, findings[0].Severity)
}

func TestSharedStateDetector_ModuleLevelList(t *testing.T) {
	source := `
RESULTS = []

def test_append():
    RESULTS.append(42)
`
	findings := analyzeWith(t, source, &detectors.SharedStateDetector{})
	require.NotEmpty(t, findings)
	assert.Equal(t, "STATE001", findings[0].RuleID)
}

func TestSharedStateDetector_ImmutableIsClean(t *testing.T) {
	source := `
MAX_RETRIES = 3
BASE_URL = "http://localhost"
DEBUG = False
`
	findings := analyzeWith(t, source, &detectors.SharedStateDetector{})
	assert.Empty(t, findings, "immutable module-level vars should not be flagged")
}

// ─── AsyncDetector ────────────────────────────────────────────────────────────

func TestAsyncDetector_BlockingCallInAsync(t *testing.T) {
	source := `
import time

async def test_fetch():
    time.sleep(5)
    result = await fetch_data()
    assert result is not None
`
	findings := analyzeWith(t, source, &detectors.AsyncDetector{})
	require.NotEmpty(t, findings, "expected ASYNC001 for time.sleep inside async def")
	assert.Equal(t, "ASYNC001", findings[0].RuleID)
	assert.Equal(t, detectors.SeverityHigh, findings[0].Severity)
	assert.Contains(t, findings[0].SuggestedFix, "asyncio.sleep")
}

func TestAsyncDetector_CleanAsync_NoFindings(t *testing.T) {
	source := `
import asyncio

async def test_fetch():
    await asyncio.sleep(0.1)
    result = await fetch_data()
    assert result is not None
`
	findings := analyzeWith(t, source, &detectors.AsyncDetector{})
	assert.Empty(t, findings, "clean async code should produce no findings")
}

// ─── Scorer ───────────────────────────────────────────────────────────────────

func TestScorer_EmptyFindings_ZeroScore(t *testing.T) {
	score := scorer.Score(nil)
	assert.Equal(t, 0.0, score)
}

func TestScorer_CriticalFinding_HighScore(t *testing.T) {
	findings := []detectors.Finding{
		{
			RuleID:     "STATE001",
			Category:   detectors.CategoryState,
			Severity:   detectors.SeverityCritical,
			Confidence: 0.95,
		},
	}
	score := scorer.Score(findings)
	assert.GreaterOrEqual(t, score, 0.75, "CRITICAL finding must produce score >= 0.75")
	assert.Equal(t, "CRITICAL", scorer.RiskLabel(score))
}

func TestScorer_MultipleHighFindings_ScoreAccumulates(t *testing.T) {
	single := scorer.Score([]detectors.Finding{
		{Category: detectors.CategoryTimeout, Severity: detectors.SeverityHigh, Confidence: 0.9},
	})
	multiple := scorer.Score([]detectors.Finding{
		{Category: detectors.CategoryTimeout, Severity: detectors.SeverityHigh, Confidence: 0.9},
		{Category: detectors.CategoryAsync, Severity: detectors.SeverityHigh, Confidence: 0.9},
		{Category: detectors.CategoryState, Severity: detectors.SeverityMedium, Confidence: 0.8},
	})
	assert.Greater(t, multiple, single, "more findings should produce a higher score")
}

func TestScorer_LowFindings_LowLabel(t *testing.T) {
	findings := []detectors.Finding{
		{Category: detectors.CategoryTimeout, Severity: detectors.SeverityLow, Confidence: 0.5},
	}
	score := scorer.Score(findings)
	assert.Less(t, score, 0.5)
}
