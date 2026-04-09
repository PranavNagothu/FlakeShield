"""Dashboard API — aggregated analytics for the Next.js frontend.
Read-only endpoints are public (no auth required).
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import AnalysisJob, Finding, Repo

router = APIRouter()


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    repo_count = (await db.execute(select(func.count(Repo.id)))).scalar() or 0
    job_count = (await db.execute(select(func.count(AnalysisJob.id)))).scalar() or 0
    finding_count = (await db.execute(select(func.count(Finding.id)))).scalar() or 0
    avg_score = (await db.execute(select(func.avg(AnalysisJob.flakiness_score)))).scalar() or 0.0
    return {
        "total_repos": repo_count,
        "total_jobs": job_count,
        "total_findings": finding_count,
        "avg_flakiness_score": round(float(avg_score), 3),
    }


@router.get("/top-patterns")
async def get_top_patterns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Finding.rule_id, func.count(Finding.id).label("count"))
        .group_by(Finding.rule_id)
        .order_by(func.count(Finding.id).desc())
        .limit(10)
    )
    return [{"rule_id": row.rule_id, "count": row.count} for row in result]


@router.get("/heatmap")
async def get_heatmap(db: AsyncSession = Depends(get_db)):
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


@router.get("/repos")
async def get_repos_summary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            Repo.id, Repo.owner, Repo.name,
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
        for row in result
    ]
