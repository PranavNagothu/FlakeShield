"""SQLAlchemy ORM models for FlakeShield."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.db import Base

import enum


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class TeamRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    viewer = "viewer"


# ─── Repo ─────────────────────────────────────────────────────────────────────

class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    github_repo_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    install_id: Mapped[int] = mapped_column(Integer, nullable=True)
    default_branch: Mapped[str] = mapped_column(String(100), default="main")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    jobs: Mapped[list["AnalysisJob"]] = relationship("AnalysisJob", back_populates="repo")

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.name}"


# ─── AnalysisJob ──────────────────────────────────────────────────────────────

class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repos.id"), nullable=False)
    pr_number: Mapped[int] = mapped_column(Integer, nullable=True)
    commit_sha: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.pending)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    total_findings: Mapped[int] = mapped_column(Integer, default=0)
    flakiness_score: Mapped[float] = mapped_column(Float, default=0.0)

    repo: Mapped["Repo"] = relationship("Repo", back_populates="jobs")
    findings: Mapped[list["Finding"]] = relationship("Finding", back_populates="job")


# ─── Finding ─────────────────────────────────────────────────────────────────

class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analysis_jobs.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    rule_id: Mapped[str] = mapped_column(String(20), nullable=False)   # e.g. TIMEOUT001
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # async/state/timeout/order
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    line_start: Mapped[int] = mapped_column(Integer, nullable=False)
    line_end: Mapped[int] = mapped_column(Integer, nullable=False)
    snippet: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    fix_patch: Mapped[str] = mapped_column(Text, nullable=True)
    flakiness_score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job: Mapped["AnalysisJob"] = relationship("AnalysisJob", back_populates="findings")


# ─── Team ─────────────────────────────────────────────────────────────────────

class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    members: Mapped[list["TeamMember"]] = relationship("TeamMember", back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[TeamRole] = mapped_column(Enum(TeamRole), default=TeamRole.viewer)

    team: Mapped["Team"] = relationship("Team", back_populates="members")
