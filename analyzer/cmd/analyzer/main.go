package main

import (
	"fmt"
	"os"
)

// Entry point for the FlakeShield static analysis engine.
// Phase 2 implementation lives in internal/parser and internal/detectors.
func main() {
	fmt.Println("FlakeShield Analyzer — starting up")
	port := os.Getenv("GRPC_PORT")
	if port == "" {
		port = "50051"
	}
	fmt.Printf("gRPC server will listen on :%s\n", port)
	// Phase 2: wire up gRPC server, detectors, and Redis cache here
}
