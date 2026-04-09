// Package scorer computes a composite flakiness risk score from a set of findings.
// Score is a float64 in [0.0, 1.0]:
//   0.00-0.25: Low risk    (green)
//   0.25-0.50: Medium risk (yellow)
//   0.50-0.75: High risk   (orange)
//   0.75-1.00: Critical    (red)
package scorer

import (
	"math"

	"github.com/PranavNagothu/FlakeShield/analyzer/internal/detectors"
)

// severityWeight maps each severity level to a base contribution to the score.
var severityWeight = map[detectors.Severity]float64{
	detectors.SeverityLow:      0.10,
	detectors.SeverityMedium:   0.25,
	detectors.SeverityHigh:     0.50,
	detectors.SeverityCritical: 0.80,
}

// categoryWeight amplifies certain categories that are empirically more flaky.
var categoryWeight = map[detectors.Category]float64{
	detectors.CategoryAsync:   1.2,
	detectors.CategoryState:   1.3,
	detectors.CategoryTimeout: 1.0,
	detectors.CategoryOrder:   1.4,
}

// Score computes a composite flakiness score in [0.0, 1.0] from a list of findings.
//
// Algorithm:
//  1. For each finding: contribution = severityWeight[sev] * categoryWeight[cat] * confidence
//  2. Sum all contributions
//  3. Apply sigmoid-like normalization to bound to [0.0, 1.0]
//  4. Apply a minimum floor if any CRITICAL finding exists
func Score(findings []detectors.Finding) float64 {
	if len(findings) == 0 {
		return 0.0
	}

	rawScore := 0.0
	hasCritical := false
	hasHigh := false

	for _, f := range findings {
		sw := severityWeight[f.Severity]
		cw := categoryWeight[f.Category]
		if cw == 0 {
			cw = 1.0
		}
		rawScore += sw * cw * f.Confidence

		if f.Severity == detectors.SeverityCritical {
			hasCritical = true
		}
		if f.Severity == detectors.SeverityHigh {
			hasHigh = true
		}
	}

	// Normalize: bounded logistic curve s.t. a single HIGH finding ≈ 0.5
	normalized := 1.0 - math.Exp(-rawScore*0.8)

	// Apply floor guarantees for critical/high findings
	switch {
	case hasCritical:
		normalized = math.Max(normalized, 0.75)
	case hasHigh:
		normalized = math.Max(normalized, 0.50)
	}

	// Cap at 1.0
	if normalized > 1.0 {
		normalized = 1.0
	}

	return math.Round(normalized*1000) / 1000 // 3 decimal places
}

// RiskLabel returns a human-readable label for a score.
func RiskLabel(score float64) string {
	switch {
	case score >= 0.75:
		return "CRITICAL"
	case score >= 0.50:
		return "HIGH"
	case score >= 0.25:
		return "MEDIUM"
	default:
		return "LOW"
	}
}
