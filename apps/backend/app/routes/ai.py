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


MODE_ALIASES = {
    "enhancement": "enhance",
    "improve": "enhance",
    "expansion": "expand",
    "strict teaching": "teaching",
    "strict_teaching": "teaching",
}


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


def _normalize_mode(mode: str) -> str:
    normalized = mode.strip().lower()
    return MODE_ALIASES.get(normalized, normalized)


def _looks_like_code(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False

    return bool(
        "\n" in stripped
        or re.search(
            r"[{}();]|=>|\b(const|let|var|function|class|def|import|export|return|if|else|for|while|interface|type|async|await|SELECT|INSERT|UPDATE|DELETE)\b",
            stripped,
            re.IGNORECASE,
        )
    )


def _clean_context(context: str | None) -> str | None:
    if not context:
        return None

    cleaned = context.strip()
    if not cleaned or cleaned == "Deexen IDE":
        return None

    return cleaned


def _diagnostics_for(code: str) -> list[str]:
    if not code.strip():
        return []

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


def _summarize_code(code: str, language: str) -> list[str]:
    if not code.strip():
        return []

    non_empty_lines = [line for line in code.splitlines() if line.strip()]
    summary = [f"- Reviewed {len(non_empty_lines)} non-empty lines of {language}."]

    if re.search(r"\b(function|def|class|interface)\b", code):
        summary.append("- The file contains reusable units such as functions, classes, or interfaces.")
    if re.search(r"\btry\b|\bcatch\b", code):
        summary.append("- There is explicit error-handling logic present.")
    if re.search(r"\bfetch\b|\baxios\b|\brequests\b|\bhttp\b", code, re.IGNORECASE):
        summary.append("- The code appears to perform I/O or network work.")

    return summary


def _build_response(
    mode: str,
    language: str,
    diagnostics: list[str],
    context: str | None,
    code_summary: list[str],
) -> str:
    language_label = "your code" if language == "plaintext" else f"{language} code"
    diagnostics_block = "\n".join(diagnostics) if diagnostics else "- No static findings were produced for this request."
    summary_block = "\n".join(code_summary) if code_summary else "- No source file was attached, so this answer is based on the request context only."
    request_block = f"**Request Context**\n- {context}" if context else ""

    if mode == "debug":
        sections = [
            f"**Debug Analysis ({language_label})**",
            request_block,
            f"**Code Snapshot**\n{summary_block}",
            f"**Findings**\n{diagnostics_block}",
            "**Next Step**\n- Re-run the failing path and capture the exact stack trace or failing input.",
        ]
        return "\n\n".join(section for section in sections if section)
    if mode == "enhance":
        sections = [
            f"**Code Enhancement Suggestions ({language_label})**",
            request_block,
            f"**Code Snapshot**\n{summary_block}",
            f"**Quality Signals**\n{diagnostics_block}",
            "**Refactor Ideas**\n- Split long functions into focused helpers.\n- Normalize naming and keep comments only where logic is non-obvious.\n- Add or tighten tests around critical paths.",
        ]
        return "\n\n".join(section for section in sections if section)
    if mode == "expand":
        sections = [
            f"**Feature Expansion Plan ({language_label})**",
            request_block,
            f"**Current Shape**\n{summary_block}",
            "**Expansion Opportunities**\n- Add validation and edge-case guards.\n- Add resilient error handling and user-friendly failure states.\n- Add tests for success and failure paths before layering on new features.",
            f"**Current Signals**\n{diagnostics_block}",
        ]
        return "\n\n".join(section for section in sections if section)
    if mode == "teaching":
        sections = [
            f"**Teaching Mode ({language_label})**",
            request_block,
            f"**What We Are Looking At**\n{summary_block}",
            "**What to focus on first**\n- Trace input -> transformation -> output.\n- Verify each assumption with a tiny test case.\n- Explain one block in your own words before changing it.",
            f"**Guided Hints**\n{diagnostics_block}",
        ]
        return "\n\n".join(section for section in sections if section)
    if mode == "livefix":
        sections = [
            f"**Live Fix Monitor ({language_label})**",
            request_block,
            f"**File Snapshot**\n{summary_block}",
            f"**Immediate Signals**\n{diagnostics_block}",
            "**Live checks**\n- Re-run lint/tests after each save.\n- Keep functions short and validate boundaries.\n- Fix the first concrete issue before broad refactors.",
        ]
        return "\n\n".join(section for section in sections if section)

    sections = [
        f"**Analysis ({language_label})**",
        request_block,
        f"**Code Snapshot**\n{summary_block}",
        f"**Findings**\n{diagnostics_block}",
    ]
    return "\n\n".join(section for section in sections if section)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_code(
    data: AnalyzeRequest,
    _current_user: User = Depends(get_current_user),
) -> AnalyzeResponse:
    started = time.perf_counter()
    code = data.code or ""
    mode = _normalize_mode(data.mode or "debug")
    model = (data.model or "gemini").strip()
    context = _clean_context(data.context)

    has_code = _looks_like_code(code)
    if not has_code and code.strip() and not context:
        context = code.strip()
    if not has_code:
        code = ""

    language = _detect_language(data.language, code)
    diagnostics = _diagnostics_for(code)
    code_summary = _summarize_code(code, language)
    response = _build_response(mode, language, diagnostics, context, code_summary)

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    token_estimate = max(1, math.ceil(len(code + response) / 4))

    return AnalyzeResponse(
        response=response,
        mode=mode,
        model=model,
        tokens=token_estimate,
        processingTime=elapsed_ms,
    )
