// Package parser wraps go-tree-sitter to provide language-agnostic AST parsing
// for the FlakeShield static analysis engine.
package parser

import (
	"context"
	"fmt"

	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/python"
	"github.com/smacker/go-tree-sitter/typescript/typescript"
)

// Language represents a supported analysis target.
type Language string

const (
	Python     Language = "python"
	TypeScript Language = "typescript"
)

// ParseResult holds the parsed AST and the original source bytes.
type ParseResult struct {
	Tree     *sitter.Tree
	Root     *sitter.Node
	Source   []byte
	Language Language
}

// Parser wraps tree-sitter with language selection and error handling.
type Parser struct {
	inner *sitter.Parser
}

// New creates a new Parser instance.
func New() *Parser {
	return &Parser{
		inner: sitter.NewParser(),
	}
}

// Parse parses source code in the given language and returns the AST root.
// Returns an error if the language is unsupported or the source fails to parse.
func (p *Parser) Parse(ctx context.Context, lang Language, source []byte) (*ParseResult, error) {
	grammar, err := grammarFor(lang)
	if err != nil {
		return nil, err
	}

	p.inner.SetLanguage(grammar)

	tree, err := p.inner.ParseCtx(ctx, nil, source)
	if err != nil {
		return nil, fmt.Errorf("tree-sitter parse failed: %w", err)
	}
	if tree == nil {
		return nil, fmt.Errorf("tree-sitter returned nil tree for language %s", lang)
	}

	root := tree.RootNode()
	if root.HasError() {
		// Don't fail hard — return the tree with a warning.
		// Partial ASTs are still useful for pattern detection.
	}

	return &ParseResult{
		Tree:     tree,
		Root:     root,
		Source:   source,
		Language: lang,
	}, nil
}

// Close releases the underlying parser resources.
func (p *Parser) Close() {
	p.inner.Close()
}

// grammarFor returns the tree-sitter Language grammar for the given Language.
func grammarFor(lang Language) (*sitter.Language, error) {
	switch lang {
	case Python:
		return python.GetLanguage(), nil
	case TypeScript:
		return typescript.GetLanguage(), nil
	default:
		return nil, fmt.Errorf("unsupported language: %q (supported: python, typescript)", lang)
	}
}

// SupportedLanguages returns all languages the parser can handle.
func SupportedLanguages() []Language {
	return []Language{Python, TypeScript}
}
