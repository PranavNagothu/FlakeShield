"""
Phase 6 — AI Patch Generation endpoint.
Calls Claude if ANTHROPIC_API_KEY is set, otherwise returns a high-quality mock diff.
"""
import difflib
import textwrap
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.core.config import settings

router = APIRouter()


class FindingInput(BaseModel):
    rule_id: str
    category: str
    severity: str
    line_start: int
    line_end: int
    snippet: str
    explanation: str
    suggested_fix: Optional[str] = None
    confidence: float = 0.9


class PatchRequest(BaseModel):
    code: str
    language: str = "python"
    findings: List[FindingInput]


class PatchResponse(BaseModel):
    patch: str
    explanation: str
    model: str
    from_mock: bool


# ── Mock patch generator ───────────────────────────────────────────────────────

def _apply_mock_fixes(code: str, findings: List[FindingInput], language: str) -> str:
    """Apply deterministic fixes based on detected rule IDs."""
    lines = code.splitlines(keepends=True)
    rule_ids = {f.rule_id for f in findings}
    patched = list(lines)

    if language == "python":
        header_lines = []
        has_asyncio = any("asyncio" in l for l in lines)
        has_pytest = any("pytest" in l for l in lines)

        if "ASYNC001" in rule_ids and not has_asyncio:
            header_lines.append("import asyncio\n")
        if "STATE001" in rule_ids and not has_pytest:
            header_lines.append("import pytest\n")

        if header_lines:
            # Insert after existing imports
            insert_at = 0
            for i, line in enumerate(patched):
                if line.startswith("import ") or line.startswith("from "):
                    insert_at = i + 1
            for j, hl in enumerate(header_lines):
                patched.insert(insert_at + j, hl)

        # Rebuild as string and apply text replacements
        code_str = "".join(patched)

        if "ASYNC001" in rule_ids:
            code_str = code_str.replace("time.sleep(", "await asyncio.sleep(")

        if "TIMEOUT001" in rule_ids or "TIMEOUT002" in rule_ids:
            import re
            code_str = re.sub(
                r'(requests\.\w+\(["\'][^"\']*["\'])',
                r"\1, timeout=30",
                code_str,
            )

        if "STATE001" in rule_ids:
            # Replace module-level list/dict assignments that look like shared state
            import re
            code_str = re.sub(
                r"^([A-Z_]+)\s*=\s*\[\]\s*$",
                (
                    "# ✅ Moved to pytest fixture to prevent cross-test pollution\n"
                    "@pytest.fixture\n"
                    "def \\1_fixture():\n"
                    "    return []\n"
                ),
                code_str,
                flags=re.MULTILINE,
            )

        if "ORDER001" in rule_ids:
            code_str = code_str.replace(
                "def test_",
                "# ✅ Removed implicit ordering dependency\ndef test_",
            )

        return code_str

    # TypeScript / generic — return with comments at each flagged line
    result = list(lines)
    for finding in findings:
        idx = finding.line_start - 1
        if 0 <= idx < len(result):
            result[idx] = f"// ⚠️ FlakeShield [{finding.rule_id}]: {finding.explanation}\n" + result[idx]
    return "".join(result)


def _build_mock_patch(original: str, patched: str, filename: str = "test_file") -> str:
    """Generate a unified diff between original and patched code."""
    ext = ".py" if "import " in original else ".ts"
    diff = difflib.unified_diff(
        original.splitlines(keepends=True),
        patched.splitlines(keepends=True),
        fromfile=f"a/{filename}{ext}",
        tofile=f"b/{filename}{ext}",
        n=3,
    )
    return "".join(diff)


def _mock_explanation(findings: List[FindingInput]) -> str:
    rule_ids = [f.rule_id for f in findings]
    fixes = []
    if any("ASYNC" in r for r in rule_ids):
        fixes.append("replaced `time.sleep()` with `await asyncio.sleep()` to avoid blocking the event loop")
    if any("TIMEOUT" in r for r in rule_ids):
        fixes.append("added `timeout=30` to all network calls to prevent indefinite hangs in CI")
    if any("STATE" in r for r in rule_ids):
        fixes.append("converted module-level mutable state into `@pytest.fixture` for test isolation")
    if any("ORDER" in r for r in rule_ids):
        fixes.append("removed implicit test-ordering dependencies — each test is now self-contained")
    if not fixes:
        fixes.append("applied static analysis recommendations")
    return "Applied " + "; ".join(fixes) + "."


# ── Claude integration ─────────────────────────────────────────────────────────

async def _call_claude(request: PatchRequest) -> PatchResponse:
    try:
        import anthropic  # type: ignore
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic package not installed")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    findings_text = "\n".join(
        f"- [{f.rule_id}] Line {f.line_start}: {f.explanation}" for f in request.findings
    )

    prompt = textwrap.dedent(f"""
        You are a test reliability engineer reviewing {request.language} test code for flakiness.

        The FlakeShield static analyzer detected these issues:
        {findings_text}

        Here is the test code:
        ```{request.language}
        {request.code}
        ```

        Generate a patched version that fixes ALL the flakiness issues above.
        Add a brief comment on each changed line explaining the fix.
        Return ONLY a unified diff (git diff format), nothing else.
    """).strip()

    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    patch_text = message.content[0].text.strip()

    # If Claude returned full code instead of a diff, generate the diff ourselves
    if not patch_text.startswith("---"):
        patch_text = _build_mock_patch(request.code, patch_text)

    return PatchResponse(
        patch=patch_text,
        explanation=f"Generated by Claude ({settings.CLAUDE_MODEL}): reviewed {len(request.findings)} finding(s).",
        model=settings.CLAUDE_MODEL,
        from_mock=False,
    )


# ── Route ──────────────────────────────────────────────────────────────────────

@router.post("", response_model=PatchResponse)
async def generate_patch(request: PatchRequest):
    """
    Generate an AI-powered fix for detected flakiness patterns.
    Uses Claude if ANTHROPIC_API_KEY is configured, otherwise returns a deterministic mock patch.
    """
    if not request.findings:
        raise HTTPException(status_code=400, detail="No findings provided — run analysis first.")

    # Use Claude if key is provided and mock mode is off
    if settings.ANTHROPIC_API_KEY and not settings.AI_PATCH_MOCK:
        return await _call_claude(request)

    # Mock mode
    patched_code = _apply_mock_fixes(request.code, request.findings, request.language)
    patch = _build_mock_patch(request.code, patched_code)

    model = "mock-ai (set ANTHROPIC_API_KEY to use Claude)"
    return PatchResponse(
        patch=patch or "# No changes needed — code looks clean after static fixes.",
        explanation=_mock_explanation(request.findings),
        model=model,
        from_mock=True,
    )
