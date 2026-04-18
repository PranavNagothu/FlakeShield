"""Analysis service — orchestrates the full analysis pipeline."""
import httpx
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models import AnalysisJob, Finding, Repo, JobStatus


async def trigger_analysis(
    repo_full_name: str,
    repo_github_id: int,
    pr_number: int,
    commit_sha: str,
    install_id: Optional[int],
    db: AsyncSession,
):
    """
    Full analysis pipeline:
    1. Look up or create Repo record
    2. Create AnalysisJob (status=running)
    3. Fetch changed test files from GitHub API
    4. Call Go analyzer HTTP endpoint for each file
    5. Persist findings
    6. Update job status + score
    """
    # 1. Get or create repo
    owner, name = repo_full_name.split("/", 1)
    result = await db.execute(select(Repo).where(Repo.github_repo_id == repo_github_id))
    repo = result.scalar_one_or_none()
    if not repo:
        repo = Repo(github_repo_id=repo_github_id, owner=owner, name=name, install_id=install_id)
        db.add(repo)
        await db.flush()

    # 2. Create job
    job = AnalysisJob(
        repo_id=repo.id,
        pr_number=pr_number,
        commit_sha=commit_sha,
        status=JobStatus.running,
    )
    db.add(job)
    await db.flush()

    try:
        # 3. Fetch test files from GitHub (simplified: real impl uses GitHub API diff)
        test_files = await fetch_pr_test_files(repo_full_name, pr_number, commit_sha)

        all_findings = []
        max_score = 0.0

        # 4. Call Go analyzer for each file
        async with httpx.AsyncClient(timeout=30.0) as client:
            for file_info in test_files:
                try:
                    resp = await client.post(
                        f"{settings.ANALYZER_HTTP_URL}/analyze",
                        json={
                            "repo_id": str(repo.id),
                            "commit_sha": commit_sha,
                            "file_path": file_info["path"],
                            "language": file_info["language"],
                            "content": file_info["content"],
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()

                    for f in data.get("findings", []):
                        finding = Finding(
                            job_id=job.id,
                            file_path=file_info["path"],
                            rule_id=f["rule_id"],
                            category=f["category"],
                            severity=f["severity"],
                            line_start=f["line_start"],
                            line_end=f["line_end"],
                            snippet=f["snippet"],
                            explanation=f["explanation"],
                            fix_patch=f.get("suggested_fix"),
                            flakiness_score=data.get("flakiness_score", 0.0),
                            confidence=f.get("confidence", 0.0),
                        )
                        db.add(finding)
                        all_findings.append(finding)

                    if data.get("flakiness_score", 0) > max_score:
                        max_score = data["flakiness_score"]

                except httpx.HTTPError:
                    continue  # don't fail the whole job on a single file error

        # 5. Update job
        job.status = JobStatus.completed
        job.completed_at = datetime.now(timezone.utc)
        job.total_findings = len(all_findings)
        job.flakiness_score = max_score
        await db.commit()

    except Exception:
        job.status = JobStatus.failed
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()
        raise


async def fetch_pr_test_files(repo_full_name: str, pr_number: int, commit_sha: str) -> list:
    """
    Fetch test files changed in a PR from GitHub API.
    Returns list of {path, language, content} dicts.
    In dev/mock mode returns a sample flaky test for demonstration.
    """
    if not settings.GITHUB_APP_PRIVATE_KEY:
        # Mock mode: return a sample flaky test file for local dev
        return [
            {
                "path": "tests/test_api.py",
                "language": "python",
                "content": (
                    "import time\n\n"
                    "RESULTS = []\n\n"
                    "def test_api_response():\n"
                    "    time.sleep(5)\n"
                    "    assert get_status() == 200\n"
                ),
            }
        ]

    # Real: use GitHub API with installation token
    # TODO: implement GitHub App auth + diff fetching
    return []
