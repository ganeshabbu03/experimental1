from __future__ import annotations

import math
import re
import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.models.user import User
from app.routes.auth import get_current_user

router = APIRouter()


class AnalyzeRequest(BaseModel):
    code: str = Field(default="")
    mode: str = Field(default="debug")
    model: str = Field(default="gemini")
    context: str | None = None
    language: str | None = None


class AnalyzeResponse(BaseModel):
    response: str
    mode: str
    model: str
    tokens: int
    processingTime: int


def _detect_language(explicit_language: str | None, code: str) -> str:
    if explicit_language and explicit_language.strip():
        return explicit_language.strip().lower()

    lowered = code.lower()
    if "package main" in lowered or "fmt.println" in lowered:
        return "go"
    if "def " in lowered or "import " in lowered and "python" in lowered:
        return "python"
    if "interface " in lowered or ": string" in lowered or "=> " in lowered:
        return "typescript"
    if "function " in lowered or "console.log" in lowered:
        return "javascript"
    return "plaintext"


def _diagnostics_for(code: str) -> list[str]:
    checks: list[tuple[str, str]] = [
        (r"\bconsole\.log\(", "Avoid committing debug logs to production code."),
        (r"\bany\b", "Using 'any' reduces type safety."),
        (r"\bprint\(", "Consider structured logging for production flows."),
        (r"\bfmt\.Println\(", "Prefer fmt.Printf when formatting values."),
    ]
    findings: list[str] = []
    lines = code.splitlines()
    for i, line in enumerate(lines, start=1):
        for pattern, message in checks:
            if re.search(pattern, line):
                findings.append(f"- line {i}: {message}")
    if not findings:
        findings.append("- No obvious static issues were detected.")
    return findings[:10]


def _build_response(mode: str, language: str, diagnostics: list[str]) -> str:
    language_label = "your code" if language == "plaintext" else f"{language} code"
    diagnostics_block = "\n".join(diagnostics)

    if mode == "debug":
        return (
            f"**Debug Analysis ({language_label})**\n\n"
            f"{diagnostics_block}\n\n"
            "**Next Step**\n"
            "- Run once and share the runtime stack trace for exact fixes."
        )
    if mode == "enhance":
        return (
            f"**Code Enhancement Suggestions ({language_label})**\n\n"
            f"{diagnostics_block}\n\n"
            "**Refactor Ideas**\n"
            "- Split long functions into focused helpers.\n"
            "- Normalize naming and add concise comments on complex logic.\n"
            "- Add basic tests for critical paths."
        )
    if mode == "expand":
        return (
            f"**Feature Expansion Plan ({language_label})**\n\n"
            "- Add validation and edge-case guards.\n"
            "- Add resilient error handling and user-friendly messages.\n"
            "- Add tests for success/failure paths.\n\n"
            "**Current Signals**\n"
            f"{diagnostics_block}"
        )
    if mode == "teaching":
        return (
            f"**Teaching Mode ({language_label})**\n\n"
            "**What to focus on first**\n"
            "- Trace input -> transformation -> output.\n"
            "- Verify assumptions with small test cases.\n\n"
            "**Guided Hints**\n"
            f"{diagnostics_block}"
        )
    if mode == "livefix":
        return (
            f"**Live Fix Monitor ({language_label})**\n\n"
            f"{diagnostics_block}\n\n"
            "**Live checks**\n"
            "- Run lint/tests after each save.\n"
            "- Keep functions short and validate boundaries."
        )

    return f"**Analysis ({language_label})**\n\n{diagnostics_block}"


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_code(
    data: AnalyzeRequest,
    _current_user: User = Depends(get_current_user),
) -> AnalyzeResponse:
    started = time.perf_counter()
    code = data.code or ""
    mode = (data.mode or "debug").strip().lower()
    model = (data.model or "gemini").strip()

    language = _detect_language(data.language, code)
    diagnostics = _diagnostics_for(code)
    response = _build_response(mode, language, diagnostics)

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    token_estimate = max(1, math.ceil(len(code + response) / 4))

    return AnalyzeResponse(
        response=response,
        mode=mode,
        model=model,
        tokens=token_estimate,
        processingTime=elapsed_ms,
    )

