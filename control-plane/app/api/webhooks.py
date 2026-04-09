"""Webhook API — receives GitHub App events and triggers analysis jobs."""
import hashlib
import hmac
import json

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.core.config import settings
from app.core.db import get_db
from app.services.analysis_service import trigger_analysis

router = APIRouter()


def verify_github_signature(payload: bytes, signature: str) -> bool:
    """Verify the GitHub webhook HMAC-SHA256 signature."""
    if not settings.GITHUB_WEBHOOK_SECRET:
        return True  # skip verification in dev mode
    expected = "sha256=" + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives GitHub App webhooks.
    On pull_request (opened/synchronize), triggers an analysis job.
    """
    payload_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not verify_github_signature(payload_bytes, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event_type = request.headers.get("X-GitHub-Event", "")
    payload = json.loads(payload_bytes)

    if event_type == "pull_request" and payload.get("action") in ("opened", "synchronize", "reopened"):
        pr = payload["pull_request"]
        repo_data = payload["repository"]

        background_tasks.add_task(
            trigger_analysis,
            repo_full_name=repo_data["full_name"],
            repo_github_id=repo_data["id"],
            pr_number=pr["number"],
            commit_sha=pr["head"]["sha"],
            install_id=payload.get("installation", {}).get("id"),
            db=db,
        )

        return {"status": "accepted", "pr": pr["number"], "sha": pr["head"]["sha"]}

    return {"status": "ignored", "event": event_type}
