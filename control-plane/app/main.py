"""
FlakeShield Control Plane — FastAPI Application Entry Point
Phase 3 implementation: routers, middleware, and lifespan events will be added here.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="FlakeShield Control Plane",
    description="Write-time flaky test prevention platform API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "service": "flakeshield-control-plane"}


@app.get("/", tags=["System"])
async def root():
    return {"message": "FlakeShield Control Plane", "docs": "/docs"}
