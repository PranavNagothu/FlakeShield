// Package detectors — SharedStateDetector
// Rules:
//
//	STATE001: Module-level mutable variable (list/dict/set) that persists across tests
//	STATE002: Class-level mutable attribute shared across test instances
package detectors

import (
	"fmt"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
)

// SharedStateDetector finds mutable state shared between test cases.
type SharedStateDetector struct{}

func (d *SharedStateDetector) Name() string { return "SharedStateDetector" }
func (d *SharedStateDetector) Rules() []string {
	return []string{"STATE001", "STATE002"}
}

func (d *SharedStateDetector) Analyze(root *sitter.Node, source []byte) []Finding {
	var findings []Finding
	findings = append(findings, d.detectModuleLevelMutableState(root, source)...)
	findings = append(findings, d.detectClassLevelMutableAttr(root, source)...)
	return findings
}

// detectModuleLevelMutableState finds module-scope assignments to mutable containers.
//
// Pattern (Python):
//
//	_cache = {}         → STATE001
//	RESULTS = []        → STATE001
//	shared_db = set()   → STATE001
//
// These persist across test invocations unless explicitly cleared.
func (d *SharedStateDetector) detectModuleLevelMutableState(root *sitter.Node, source []byte) []Finding {
	var findings []Finding

	// Walk only top-level (module-scope) nodes — direct children of the root "module" node
	for i := 0; i < int(root.ChildCount()); i++ {
		child := root.Child(i)

		// Top-level assignment: x = {} or x = []
		if child.Type() == "expression_statement" {
			inner := child.Child(0)
			if inner == nil {
				continue
			}
			if inner.Type() == "assignment" {
				left := inner.ChildByFieldName("left")
				right := inner.ChildByFieldName("right")
				if left == nil || right == nil {
					continue
				}
				rightSnippet := ExtractSnippet(right, source)
				if isMutableLiteral(rightSnippet, right.Type()) {
					varName := ExtractSnippet(left, source)
					findings = append(findings, Finding{
						RuleID:    "STATE001",
						Category:  CategoryState,
						Severity:  SeverityCritical,
						LineStart: int(child.StartPoint().Row) + 1,
						LineEnd:   int(child.EndPoint().Row) + 1,
						Snippet:   ExtractSnippet(child, source),
						Explanation: fmt.Sprintf(
							"Module-level mutable variable '%s' persists across all tests in the file. "+
								"Tests that run first may pollute state for subsequent tests, causing "+
								"order-dependent failures in CI (random test ordering).", varName),
						SuggestedFix: fmt.Sprintf(
							"Move '%s' inside a pytest fixture with function scope:\n"+
								"@pytest.fixture\ndef %s():\n    return %s",
							varName, strings.ToLower(varName), rightSnippet),
						Confidence: 0.94,
					})
				}
			}
		}

		// Top-level augmented assignment: RESULTS += [...] at module scope
		if child.Type() == "expression_statement" {
			inner := child.Child(0)
			if inner != nil && inner.Type() == "augmented_assignment" {
				right := inner.ChildByFieldName("right")
				if right != nil && (right.Type() == "list" || right.Type() == "dictionary") {
					findings = append(findings, Finding{
						RuleID:    "STATE001",
						Category:  CategoryState,
						Severity:  SeverityHigh,
						LineStart: int(child.StartPoint().Row) + 1,
						LineEnd:   int(child.EndPoint().Row) + 1,
						Snippet:   ExtractSnippet(child, source),
						Explanation: "Module-level augmented assignment to a mutable container. " +
							"This accumulates state across tests and is a source of flakiness.",
						SuggestedFix: "Refactor into a fixture so state is reset between tests.",
						Confidence:   0.90,
					})
				}
			}
		}
	}
	return findings
}

// detectClassLevelMutableAttr finds class-body assignments to mutable types
// inside test classes, which are shared across all test method instances.
//
// Pattern (Python):
//
//	class TestMyService(unittest.TestCase):
//	    shared_results = []   → STATE002
//	    db_records = {}       → STATE002
func (d *SharedStateDetector) detectClassLevelMutableAttr(root *sitter.Node, source []byte) []Finding {
	var findings []Finding

	d.walkNode(root, func(node *sitter.Node) {
		if node.Type() != "class_definition" {
			return
		}

		className := ""
		nameNode := node.ChildByFieldName("name")
		if nameNode != nil {
			className = ExtractSnippet(nameNode, source)
		}

		// Only analyze test classes (heuristic: name starts/contains "Test")
		if !strings.Contains(className, "Test") && !strings.Contains(className, "test") {
			return
		}

		body := node.ChildByFieldName("body")
		if body == nil {
			return
		}

		// Walk class body for direct attribute assignments (not inside methods)
		for i := 0; i < int(body.ChildCount()); i++ {
			stmt := body.Child(i)
			if stmt.Type() != "expression_statement" {
				continue
			}
			inner := stmt.Child(0)
			if inner == nil || inner.Type() != "assignment" {
				continue
			}
			right := inner.ChildByFieldName("right")
			if right == nil {
				continue
			}
			rightSnippet := ExtractSnippet(right, source)
			if isMutableLiteral(rightSnippet, right.Type()) {
				left := inner.ChildByFieldName("left")
				attrName := ""
				if left != nil {
					attrName = ExtractSnippet(left, source)
				}
				findings = append(findings, Finding{
					RuleID:    "STATE002",
					Category:  CategoryState,
					Severity:  SeverityHigh,
					LineStart: int(stmt.StartPoint().Row) + 1,
					LineEnd:   int(stmt.EndPoint().Row) + 1,
					Snippet:   ExtractSnippet(stmt, source),
					Explanation: fmt.Sprintf(
						"Class-level mutable attribute '%s' in '%s' is shared across all test instances. "+
							"Mutations in one test method bleed into others, causing order-dependent failures.",
						attrName, className),
					SuggestedFix: fmt.Sprintf(
						"Initialize '%s' in setUp() or use @pytest.fixture to ensure per-test isolation.", attrName),
					Confidence: 0.91,
				})
			}
		}
	})
	return findings
}

// isMutableLiteral returns true if the snippet or node type is a mutable container literal.
func isMutableLiteral(snippet, nodeType string) bool {
	mutableTypes := []string{"list", "dictionary", "set", "list_comprehension", "dict_comprehension", "set_comprehension"}
	for _, t := range mutableTypes {
		if nodeType == t {
			return true
		}
	}
	s := strings.TrimSpace(snippet)
	return s == "[]" || s == "{}" || s == "set()" || s == "list()" || s == "dict()" ||
		strings.HasPrefix(s, "[") || strings.HasPrefix(s, "{")
}

func (d *SharedStateDetector) walkNode(node *sitter.Node, fn func(*sitter.Node)) {
	if node == nil {
		return
	}
	fn(node)
	for i := 0; i < int(node.ChildCount()); i++ {
		d.walkNode(node.Child(i), fn)
	}
}
