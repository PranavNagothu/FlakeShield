"""Repos API — register and manage GitHub repos."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user
from app.models import Repo

router = APIRouter()


class RepoCreate(BaseModel):
    github_repo_id: int
    owner: str
    name: str
    install_id: Optional[int] = None
    default_branch: str = "main"


class RepoOut(BaseModel):
    id: uuid.UUID
    github_repo_id: int
    owner: str
    name: str
    default_branch: str
    is_active: bool

    class Config:
        from_attributes = True


@router.post("/", response_model=RepoOut, status_code=201)
async def register_repo(
    body: RepoCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    existing = await db.execute(select(Repo).where(Repo.github_repo_id == body.github_repo_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Repo already registered")
    repo = Repo(**body.model_dump())
    db.add(repo)
    await db.flush()
    return repo


@router.get("/", response_model=List[RepoOut])
async def list_repos(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Repo).where(Repo.is_active is True))
    return result.scalars().all()


@router.delete("/{repo_id}", status_code=204)
async def deregister_repo(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    repo.is_active = False
