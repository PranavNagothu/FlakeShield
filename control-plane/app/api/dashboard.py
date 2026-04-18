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
        .where(Repo.is_active is True)
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


@router.get("/overview")
async def get_overview(db: AsyncSession = Depends(get_db)):
    repo_count = (await db.execute(select(func.count(Repo.id)))).scalar() or 0
    job_count = (await db.execute(select(func.count(AnalysisJob.id)))).scalar() or 0
    finding_count = (await db.execute(select(func.count(Finding.id)))).scalar() or 0
    # Estimate: each finding caught saves ~6 CI minutes on average
    ci_minutes_saved = finding_count * 6

    recent_result = await db.execute(
        select(
            AnalysisJob.id,
            AnalysisJob.commit_sha,
            AnalysisJob.pr_number,
            AnalysisJob.status,
            AnalysisJob.flakiness_score,
            AnalysisJob.total_findings,
            Repo.name.label("repo_name"),
        )
        .outerjoin(Repo, Repo.id == AnalysisJob.repo_id)
        .order_by(AnalysisJob.triggered_at.desc())
        .limit(5)
    )
    recent_jobs = [
        {
            "repo": row.repo_name or "playground",
            "pr": row.pr_number,
            "sha": (row.commit_sha or "")[:7],
            "score": round(float(row.flakiness_score or 0), 3),
            "findings": row.total_findings or 0,
            "status": row.status.value if row.status else "completed",
        }
        for row in recent_result
    ]

    return {
        "total_repos": repo_count,
        "total_analyses": job_count,
        "total_findings": finding_count,
        "ci_minutes_saved": ci_minutes_saved,
        "recent_jobs": recent_jobs,
    }


@router.post("/playground/record")
async def record_playground_session(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Called by the Playground UI after every analysis (real or mock).
    Persists job summary + individual findings so Overview AND Analytics show real data.
    """
    import uuid as _uuid
    from app.models import AnalysisJob, Repo, Finding

    # Get or create a synthetic "playground" repo
    playground_repo = (await db.execute(
        select(Repo).where(Repo.github_repo_id == 0)
    )).scalar_one_or_none()

    if not playground_repo:
        playground_repo = Repo(
            github_repo_id=0,
            owner="playground",
            name="interactive-demo",
            default_branch="main",
            is_active=True,
        )
        db.add(playground_repo)
        await db.flush()

    job = AnalysisJob(
        repo_id=playground_repo.id,
        commit_sha=payload.get("sha", str(_uuid.uuid4())[:8]),
        status="completed",
        total_findings=int(payload.get("findings_count", 0)),
        flakiness_score=float(payload.get("score", 0.0)),
    )
    db.add(job)
    await db.flush()

    # Persist individual findings for Analytics top-patterns chart
    for f in payload.get("findings", []):
        finding = Finding(
            job_id=job.id,
            file_path="playground",
            rule_id=f.get("rule_id", "UNKNOWN"),
            category=f.get("category", "unknown"),
            severity=f.get("severity", "medium"),
            line_start=int(f.get("line_start", 0)),
            line_end=int(f.get("line_end", 0)),
            snippet=f.get("snippet", ""),
            explanation=f.get("explanation", ""),
            flakiness_score=float(payload.get("score", 0.0)),
            confidence=float(f.get("confidence", 0.8)),
        )
        db.add(finding)

    await db.commit()
    return {"recorded": True}
