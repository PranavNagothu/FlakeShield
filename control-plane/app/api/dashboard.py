<<<<<<< Updated upstream
"""Dashboard API — aggregated analytics for the Next.js frontend."""
=======
"""Dashboard API — aggregated analytics for the Next.js frontend.
Read-only endpoints are public (no auth required).
"""
>>>>>>> Stashed changes
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
<<<<<<< Updated upstream
from app.core.security import get_current_user
=======
>>>>>>> Stashed changes
from app.models import AnalysisJob, Finding, Repo

router = APIRouter()


@router.get("/summary")
<<<<<<< Updated upstream
async def get_summary(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Global summary: total repos, jobs, findings, avg flakiness score."""
    repo_count = (await db.execute(select(func.count(Repo.id)))).scalar()
    job_count = (await db.execute(select(func.count(AnalysisJob.id)))).scalar()
    finding_count = (await db.execute(select(func.count(Finding.id)))).scalar()
=======
async def get_summary(db: AsyncSession = Depends(get_db)):
    """Global summary stats — public, used by dashboard Overview."""
    repo_count = (await db.execute(select(func.count(Repo.id)))).scalar() or 0
    job_count = (await db.execute(select(func.count(AnalysisJob.id)))).scalar() or 0
    finding_count = (await db.execute(select(func.count(Finding.id)))).scalar() or 0
>>>>>>> Stashed changes
    avg_score = (await db.execute(select(func.avg(AnalysisJob.flakiness_score)))).scalar() or 0.0

    return {
        "total_repos": repo_count,
        "total_jobs": job_count,
        "total_findings": finding_count,
        "avg_flakiness_score": round(float(avg_score), 3),
    }


@router.get("/top-patterns")
<<<<<<< Updated upstream
async def get_top_patterns(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Top flakiness rule IDs by frequency — for the Recharts bar chart."""
=======
async def get_top_patterns(db: AsyncSession = Depends(get_db)):
    """Top flakiness rule IDs by frequency — public, used by Analytics chart."""
>>>>>>> Stashed changes
    result = await db.execute(
        select(Finding.rule_id, func.count(Finding.id).label("count"))
        .group_by(Finding.rule_id)
        .order_by(func.count(Finding.id).desc())
        .limit(10)
    )
    return [{"rule_id": row.rule_id, "count": row.count} for row in result]


@router.get("/heatmap")
<<<<<<< Updated upstream
async def get_heatmap(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Per-file flakiness scores — for the D3.js heatmap."""
=======
async def get_heatmap(db: AsyncSession = Depends(get_db)):
    """Per-file flakiness scores — public, used by Analytics heatmap."""
>>>>>>> Stashed changes
    result = await db.execute(
        select(
            Finding.file_path,
            func.avg(Finding.flakiness_score).label("avg_score"),
            func.count(Finding.id).label("finding_count"),
        )
        .group_by(Finding.file_path)
        .order_by(func.avg(Finding.flakiness_score).desc())
        .limit(50)
    )
    return [
<<<<<<< Updated upstream
        {"file_path": row.file_path, "score": round(float(row.avg_score), 3), "findings": row.finding_count}
=======
        {
            "file_path": row.file_path,
            "score": round(float(row.avg_score), 3),
            "findings": row.finding_count,
        }
        for row in result
    ]


@router.get("/repos")
async def get_repos_summary(db: AsyncSession = Depends(get_db)):
    """Per-repo summary — public, used by Repos page."""
    result = await db.execute(
        select(
            Repo.id,
            Repo.owner,
            Repo.name,
            func.count(AnalysisJob.id).label("pr_count"),
            func.coalesce(func.avg(AnalysisJob.flakiness_score), 0).label("avg_score"),
            func.coalesce(func.sum(AnalysisJob.total_findings), 0).label("total_findings"),
        )
        .outerjoin(AnalysisJob, AnalysisJob.repo_id == Repo.id)
        .where(Repo.is_active == True)
        .group_by(Repo.id, Repo.owner, Repo.name)
        .order_by(func.coalesce(func.avg(AnalysisJob.flakiness_score), 0).desc())
    )
    return [
        {
            "id": str(row.id),
            "owner": row.owner,
            "name": row.name,
            "prs": row.pr_count,
            "score": round(float(row.avg_score), 3),
            "findings": int(row.total_findings),
        }
>>>>>>> Stashed changes
        for row in result
    ]
