"""Teams API — team management and RBAC."""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user, require_role
from app.models import Team, TeamMember, TeamRole

router = APIRouter()


class TeamCreate(BaseModel):
    org_id: str
    name: str


class TeamOut(BaseModel):
    id: uuid.UUID
    org_id: str
    name: str

    class Config:
        from_attributes = True


class MemberAdd(BaseModel):
    user_id: str
    role: TeamRole = TeamRole.viewer


@router.post("/", response_model=TeamOut, status_code=201)
async def create_team(
    body: TeamCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("owner", "admin")),
):
    team = Team(**body.model_dump())
    db.add(team)
    await db.flush()
    return team


@router.get("/", response_model=List[TeamOut])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Team))
    return result.scalars().all()


@router.post("/{team_id}/members", status_code=201)
async def add_member(
    team_id: uuid.UUID,
    body: MemberAdd,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("owner", "admin")),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Team not found")
    member = TeamMember(team_id=team_id, user_id=body.user_id, role=body.role)
    db.add(member)
    return {"status": "added", "user_id": body.user_id, "role": body.role}
