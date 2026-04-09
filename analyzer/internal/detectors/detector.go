// Package detectors defines the core Detector interface and shared types
// used by all flakiness pattern detectors.
package detectors

import sitter "github.com/smacker/go-tree-sitter"

// Category groups detectors by the root cause they target.
type Category string

const (
	CategoryAsync   Category = "async"
	CategoryState   Category = "state"
	CategoryTimeout Category = "timeout"
	CategoryOrder   Category = "order"
)

// Severity indicates how likely the pattern is to cause CI failures.
type Severity int

const (
	SeverityLow      Severity = 1
	SeverityMedium   Severity = 2
	SeverityHigh     Severity = 3
	SeverityCritical Severity = 4
)

func (s Severity) String() string {
	switch s {
	case SeverityLow:
		return "LOW"
	case SeverityMedium:
		return "MEDIUM"
	case SeverityHigh:
		return "HIGH"
	case SeverityCritical:
		return "CRITICAL"
	default:
		return "UNKNOWN"
	}
}

// Finding represents one detected flakiness pattern in the source code.
type Finding struct {
	RuleID       string // e.g. "TIMEOUT001"
	Category     Category
	Severity     Severity
	LineStart    int
	LineEnd      int
	Snippet      string  // Exact source code slice that triggered the rule
	Explanation  string  // Human-readable description of the problem
	SuggestedFix string  // Static suggestion; AI will enhance this in Phase 6
	Confidence   float64 // 0.0–1.0: how certain the detector is
}

// Detector is the interface every flakiness rule must implement.
type Detector interface {
	// Name returns the detector's identifier, e.g. "AsyncDetector".
	Name() string

	// Rules returns the rule IDs this detector can emit.
	Rules() []string

	// Analyze traverses the AST rooted at root and returns all findings.
	// source is the raw file bytes (used to extract snippets).
	Analyze(root *sitter.Node, source []byte) []Finding
}

// extractSnippet returns the exact source bytes for a tree-sitter node.
func ExtractSnippet(node *sitter.Node, source []byte) string {
	start := node.StartByte()
	end := node.EndByte()
	if int(end) > len(source) {
		end = uint32(len(source))
	}
	return string(source[start:end])
}

// lineOf returns the 1-indexed line number of a byte offset in source.
func LineOf(offset uint32, source []byte) int {
	line := 1
	for i := uint32(0); i < offset && int(i) < len(source); i++ {
		if source[i] == '\n' {
			line++
		}
	}
	return line
}
