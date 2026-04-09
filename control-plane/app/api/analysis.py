"""Analysis API — query analysis jobs and findings."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user
from app.models import AnalysisJob, Finding, JobStatus

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class FindingOut(BaseModel):
    id: uuid.UUID
    file_path: str
    rule_id: str
    category: str
    severity: str
    line_start: int
    line_end: int
    snippet: str
    explanation: str
    fix_patch: Optional[str]
    flakiness_score: float
    confidence: float

    class Config:
        from_attributes = True


class JobOut(BaseModel):
    id: uuid.UUID
    repo_id: uuid.UUID
    pr_number: Optional[int]
    commit_sha: str
    status: JobStatus
    total_findings: int
    flakiness_score: float
    triggered_at: str
    completed_at: Optional[str]

    class Config:
        from_attributes = True


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Get a single analysis job by ID."""
    result = await db.execute(select(AnalysisJob).where(AnalysisJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/{job_id}/findings", response_model=List[FindingOut])
async def get_findings(
    job_id: uuid.UUID,
    severity: Optional[str] = Query(None, description="Filter by severity: LOW, MEDIUM, HIGH, CRITICAL"),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Get all findings for a job, optionally filtered by severity."""
    q = select(Finding).where(Finding.job_id == job_id)
    if severity:
        q = q.where(Finding.severity == severity.upper())
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/repo/{repo_id}/history")
async def get_repo_history(
    repo_id: uuid.UUID,
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Return the last N analysis jobs for a repo (for timeline charts)."""
    result = await db.execute(
        select(AnalysisJob)
        .where(AnalysisJob.repo_id == repo_id)
        .order_by(AnalysisJob.triggered_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
