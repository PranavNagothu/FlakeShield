// Package detectors — TimeoutDetector
// Rules:
//   TIMEOUT001: Hardcoded literal timeout value (time.sleep(5), setTimeout(fn, 3000))
//   TIMEOUT002: Network/IO call without retry logic or timeout parameter
package detectors

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
)

// hardcodedSleepThreshold: sleeps above this value (seconds) are always flagged.
const hardcodedSleepThreshold = 0

// TimeoutDetector finds hardcoded literal timeouts that cause environment-dependent failures.
type TimeoutDetector struct{}

func (d *TimeoutDetector) Name() string { return "TimeoutDetector" }
func (d *TimeoutDetector) Rules() []string {
	return []string{"TIMEOUT001", "TIMEOUT002"}
}

func (d *TimeoutDetector) Analyze(root *sitter.Node, source []byte) []Finding {
	var findings []Finding
	findings = append(findings, d.detectHardcodedSleep(root, source)...)
	findings = append(findings, d.detectNoRetry(root, source)...)
	return findings
}

// detectHardcodedSleep finds literal numeric arguments to sleep/wait functions.
//
// Python:  time.sleep(5)        → TIMEOUT001
// Python:  asyncio.sleep(2.5)   → TIMEOUT001
// TS:      setTimeout(fn, 3000) → TIMEOUT001
// TS:      page.waitForTimeout(1000) → TIMEOUT001
func (d *TimeoutDetector) detectHardcodedSleep(root *sitter.Node, source []byte) []Finding {
	var findings []Finding

	sleepFunctions := map[string]bool{
		"time.sleep":            true,
		"asyncio.sleep":         true,
		"sleep":                 true,
		"setTimeout":            true,
		"setInterval":           true,
		"waitForTimeout":        true,
		"page.waitForTimeout":   true,
		"browser.waitForTimeout": true,
	}

	d.walkNode(root, func(node *sitter.Node) {
		if node.Type() != "call" {
			return
		}

		fnNode := node.ChildByFieldName("function")
		if fnNode == nil {
			return
		}

		fnText := ExtractSnippet(fnNode, source)
		if !sleepFunctions[fnText] && !isSleepSuffix(fnText) {
			return
		}

		argsNode := node.ChildByFieldName("arguments")
		if argsNode == nil {
			return
		}

		// Look for a literal integer or float argument
		for i := 0; i < int(argsNode.ChildCount()); i++ {
			arg := argsNode.Child(i)
			if arg.Type() == "integer" || arg.Type() == "float" || arg.Type() == "number" {
				val := ExtractSnippet(arg, source)
				numVal, _ := strconv.ParseFloat(val, 64)
				_ = numVal

				callSnippet := ExtractSnippet(node, source)
				findings = append(findings, Finding{
					RuleID:    "TIMEOUT001",
					Category:  CategoryTimeout,
					Severity:  SeverityHigh,
					LineStart: int(node.StartPoint().Row) + 1,
					LineEnd:   int(node.EndPoint().Row) + 1,
					Snippet:   callSnippet,
					Explanation: fmt.Sprintf(
						"Hardcoded timeout value '%s' makes this test sensitive to machine speed. "+
							"Slow CI runners will fail intermittently. "+
							"Use a polling loop with a dynamic timeout instead.", val),
					SuggestedFix: generateTimeoutFix(fnText, val),
					Confidence:   0.97,
				})
			}
		}
	})
	return findings
}

// detectNoRetry finds network/IO calls that have no retry logic and no timeout param.
//
// Pattern (Python):
//   requests.get(url)              → TIMEOUT002 (no timeout= kwarg)
//   requests.post(url, data=body)  → TIMEOUT002 (no timeout= kwarg)
func (d *TimeoutDetector) detectNoRetry(root *sitter.Node, source []byte) []Finding {
	var findings []Finding

	noTimeoutFunctions := []string{
		"requests.get", "requests.post", "requests.put", "requests.delete",
		"requests.patch", "requests.head", "requests.request",
		"urllib.request.urlopen", "http.get", "http.post",
		"fetch(",
	}

	d.walkNode(root, func(node *sitter.Node) {
		if node.Type() != "call" {
			return
		}
		fnNode := node.ChildByFieldName("function")
		if fnNode == nil {
			return
		}
		fnText := ExtractSnippet(fnNode, source)

		matched := false
		for _, fn := range noTimeoutFunctions {
			if strings.Contains(fnText, fn) {
				matched = true
				break
			}
		}
		if !matched {
			return
		}

		// Check if 'timeout' kwarg is present
		argsNode := node.ChildByFieldName("arguments")
		if argsNode == nil {
			return
		}
		argsText := ExtractSnippet(argsNode, source)
		if strings.Contains(argsText, "timeout") {
			return // timeout is specified, all good
		}

		callSnippet := ExtractSnippet(node, source)
		findings = append(findings, Finding{
			RuleID:    "TIMEOUT002",
			Category:  CategoryTimeout,
			Severity:  SeverityMedium,
			LineStart: int(node.StartPoint().Row) + 1,
			LineEnd:   int(node.EndPoint().Row) + 1,
			Snippet:   callSnippet,
			Explanation: "Network call without a 'timeout' parameter will hang indefinitely in CI " +
				"if the remote service is slow or unreachable. This causes test suite timeouts.",
			SuggestedFix: addTimeoutParam(callSnippet),
			Confidence:   0.88,
		})
	})
	return findings
}

func isSleepSuffix(fnText string) bool {
	lf := strings.ToLower(fnText)
	return strings.HasSuffix(lf, ".sleep") || strings.HasSuffix(lf, "wait_for_timeout")
}

func generateTimeoutFix(fn, duration string) string {
	templates := map[string]string{
		"time.sleep":  "poll_until_ready(timeout=%s, interval=0.1)",
		"asyncio.sleep": "await poll_until_ready_async(timeout=%s, interval=0.1)",
		"setTimeout":  "await waitForCondition(() => condition, { timeout: %s })",
	}
	if tmpl, ok := templates[fn]; ok {
		return fmt.Sprintf(tmpl, duration)
	}
	return fmt.Sprintf("# Replace %s(%s) with dynamic polling: poll_until_ready(timeout=%s)", fn, duration, duration)
}

var timeoutArgRe = regexp.MustCompile(`\)$`)

func addTimeoutParam(callSnippet string) string {
	return timeoutArgRe.ReplaceAllString(callSnippet, ", timeout=30)")
}

func (d *TimeoutDetector) walkNode(node *sitter.Node, fn func(*sitter.Node)) {
	if node == nil {
		return
	}
	fn(node)
	for i := 0; i < int(node.ChildCount()); i++ {
		d.walkNode(node.Child(i), fn)
	}
}
