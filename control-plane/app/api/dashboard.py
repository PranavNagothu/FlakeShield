"""Dashboard API — aggregated analytics for the Next.js frontend."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user
from app.models import AnalysisJob, Finding, Repo

router = APIRouter()


@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Global summary: total repos, jobs, findings, avg flakiness score."""
    repo_count = (await db.execute(select(func.count(Repo.id)))).scalar()
    job_count = (await db.execute(select(func.count(AnalysisJob.id)))).scalar()
    finding_count = (await db.execute(select(func.count(Finding.id)))).scalar()
    avg_score = (await db.execute(select(func.avg(AnalysisJob.flakiness_score)))).scalar() or 0.0

    return {
        "total_repos": repo_count,
        "total_jobs": job_count,
        "total_findings": finding_count,
        "avg_flakiness_score": round(float(avg_score), 3),
    }


@router.get("/top-patterns")
async def get_top_patterns(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Top flakiness rule IDs by frequency — for the Recharts bar chart."""
    result = await db.execute(
        select(Finding.rule_id, func.count(Finding.id).label("count"))
        .group_by(Finding.rule_id)
        .order_by(func.count(Finding.id).desc())
        .limit(10)
    )
    return [{"rule_id": row.rule_id, "count": row.count} for row in result]


@router.get("/heatmap")
async def get_heatmap(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Per-file flakiness scores — for the D3.js heatmap."""
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
        {"file_path": row.file_path, "score": round(float(row.avg_score), 3), "findings": row.finding_count}
        for row in result
    ]
