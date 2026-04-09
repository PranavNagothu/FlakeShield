// Package detectors — AsyncDetector
// Rules:
//   ASYNC001: async function calls blocking I/O (time.sleep in async def)
//   ASYNC002: coroutine created but not awaited (missing await keyword)
package detectors

import (
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
)

// AsyncDetector detects unguarded async/await patterns that cause flakiness.
type AsyncDetector struct{}

func (d *AsyncDetector) Name() string { return "AsyncDetector" }
func (d *AsyncDetector) Rules() []string {
	return []string{"ASYNC001", "ASYNC002"}
}

func (d *AsyncDetector) Analyze(root *sitter.Node, source []byte) []Finding {
	var findings []Finding
	findings = append(findings, d.detectBlockingInAsync(root, source)...)
	findings = append(findings, d.detectUnawaited(root, source)...)
	return findings
}

// detectBlockingInAsync finds time.sleep() calls inside async def functions.
// These block the event loop and cause non-deterministic timing.
//
// Pattern (Python):
//   async def test_something():
//       time.sleep(5)   ← ASYNC001
func (d *AsyncDetector) detectBlockingInAsync(root *sitter.Node, source []byte) []Finding {
	var findings []Finding
	d.walkNode(root, func(node *sitter.Node) {
		// Look for function_definition nodes with async keyword
		if node.Type() != "function_definition" {
			return
		}
		if !d.isAsyncFunction(node, source) {
			return
		}
		// Walk the function body for blocking calls
		body := node.ChildByFieldName("body")
		if body == nil {
			return
		}
		d.walkNode(body, func(inner *sitter.Node) {
			if inner.Type() != "call" {
				return
			}
			callText := ExtractSnippet(inner, source)
			// Detect time.sleep, os.sleep, subprocess blocking calls
			if isBlockingCall(callText) {
				findings = append(findings, Finding{
					RuleID:    "ASYNC001",
					Category:  CategoryAsync,
					Severity:  SeverityHigh,
					LineStart: int(inner.StartPoint().Row) + 1,
					LineEnd:   int(inner.EndPoint().Row) + 1,
					Snippet:   callText,
					Explanation: "Blocking call inside an async function blocks the event loop " +
						"and can cause non-deterministic timing failures in CI. " +
						"Use the async equivalent instead.",
					SuggestedFix: strings.Replace(callText, "time.sleep(", "await asyncio.sleep(", 1),
					Confidence:   0.92,
				})
			}
		})
	})
	return findings
}

// detectUnawaited finds coroutine calls that are not awaited.
// This causes the coroutine to never execute, leading to silent test failures.
//
// Pattern (Python):
//   async def test_something():
//       fetch_data()   ← ASYNC002 (should be: await fetch_data())
func (d *AsyncDetector) detectUnawaited(root *sitter.Node, source []byte) []Finding {
	var findings []Finding
	d.walkNode(root, func(node *sitter.Node) {
		if node.Type() != "function_definition" {
			return
		}
		if !d.isAsyncFunction(node, source) {
			return
		}
		body := node.ChildByFieldName("body")
		if body == nil {
			return
		}
		// Find expression_statement nodes that contain a bare call (no await)
		d.walkNode(body, func(inner *sitter.Node) {
			if inner.Type() != "expression_statement" {
				return
			}
			child := inner.Child(0)
			if child == nil || child.Type() != "call" {
				return
			}
			// If parent of this call is NOT an await expression, flag it
			if !d.hasAwaitAncestor(inner) && d.looksLikeCoroutine(child, source) {
				snippet := ExtractSnippet(child, source)
				findings = append(findings, Finding{
					RuleID:    "ASYNC002",
					Category:  CategoryAsync,
					Severity:  SeverityCritical,
					LineStart: int(child.StartPoint().Row) + 1,
					LineEnd:   int(child.EndPoint().Row) + 1,
					Snippet:   snippet,
					Explanation: "Coroutine called without 'await' — it will never execute. " +
						"This causes tests to pass silently while the actual code path is never run.",
					SuggestedFix: "await " + snippet,
					Confidence:   0.85,
				})
			}
		})
	})
	return findings
}

// isAsyncFunction returns true if a function_definition node has the async keyword.
func (d *AsyncDetector) isAsyncFunction(node *sitter.Node, source []byte) bool {
	// Check for "async" as a named child or in the function text
	for i := 0; i < int(node.ChildCount()); i++ {
		child := node.Child(i)
		if child.Type() == "async" {
			return true
		}
	}
	// Fallback: check raw text
	snippet := ExtractSnippet(node, source)
	return strings.HasPrefix(strings.TrimSpace(snippet), "async def")
}

// hasAwaitAncestor returns true if any ancestor node is an await expression.
func (d *AsyncDetector) hasAwaitAncestor(node *sitter.Node) bool {
	cur := node.Parent()
	for cur != nil {
		if cur.Type() == "await" {
			return true
		}
		cur = cur.Parent()
	}
	return false
}

// looksLikeCoroutine heuristically determines if a call is likely a coroutine.
// Looks for function names ending in common async suffixes.
func (d *AsyncDetector) looksLikeCoroutine(call *sitter.Node, source []byte) bool {
	fn := call.ChildByFieldName("function")
	if fn == nil {
		return false
	}
	name := ExtractSnippet(fn, source)
	asyncSuffixes := []string{"async", "coroutine", "_coro", "fetch", "request", "connect", "disconnect"}
	nameLower := strings.ToLower(name)
	for _, suffix := range asyncSuffixes {
		if strings.Contains(nameLower, suffix) {
			return true
		}
	}
	return false
}

// isBlockingCall returns true if the call text is a known blocking operation.
func isBlockingCall(callText string) bool {
	blockingPatterns := []string{
		"time.sleep(",
		"os.system(",
		"subprocess.call(",
		"subprocess.run(",
		"subprocess.check_output(",
		"requests.get(",
		"requests.post(",
		"urllib.request",
	}
	for _, pattern := range blockingPatterns {
		if strings.Contains(callText, pattern) {
			return true
		}
	}
	return false
}

// walkNode performs a depth-first traversal over a tree-sitter AST node.
func (d *AsyncDetector) walkNode(node *sitter.Node, fn func(*sitter.Node)) {
	if node == nil {
		return
	}
	fn(node)
	for i := 0; i < int(node.ChildCount()); i++ {
		d.walkNode(node.Child(i), fn)
	}
}
