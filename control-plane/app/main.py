"""
FlakeShield Control Plane — FastAPI Application
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import engine, Base
from app.api import webhooks, analysis, repos, teams, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="FlakeShield Control Plane",
    description="Write-time flaky test prevention platform API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])
app.include_router(repos.router, prefix="/repos", tags=["Repos"])
app.include_router(teams.router, prefix="/teams", tags=["Teams"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "service": "flakeshield-control-plane", "version": "0.1.0"}


@app.get("/", tags=["System"])
async def root():
    return {"message": "FlakeShield Control Plane", "docs": "/docs"}
