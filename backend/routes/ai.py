"""
routes/ai.py
------------
AI-powered incident classification:

  POST /api/classify   — send incident text to Claude, get back:
                           { severity, is_harassment, tags, summary, route_advice }

Claude model: claude-sonnet-4-20250514
Falls back to keyword matching if no API key is configured.
"""

import json
import os
import urllib.request

from flask import Blueprint, request, jsonify
from middleware import auth_required

ai_bp = Blueprint("ai", __name__, url_prefix="/api")

# Read from environment; can also be passed per-request in the body
_ENV_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

_SYSTEM_PROMPT = """You are a public safety AI embedded in SAFARA, a women's safety navigation app.
Analyze the incident report and respond with valid JSON only — no extra text.
Schema:
{
  "severity": "LOW" | "MEDIUM" | "HIGH",
  "is_harassment": boolean,
  "tags": string[],
  "summary": string,
  "route_advice": string
}
Severity guide:
  LOW    = environmental risk (poor lighting, isolated area)
  MEDIUM = suspicious or threatening behaviour
  HIGH   = direct harassment, physical threat, or assault
Keep summary and route_advice calm and reassuring — never alarming."""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _keyword_fallback(text: str) -> dict:
    """Simple keyword classifier used when no Claude API key is available."""
    lower = text.lower()
    if any(w in lower for w in ["assault", "grab", "attack"]):
        severity = "HIGH"
    elif any(w in lower for w in ["follow", "suspicious", "stare", "uncomfortable", "unsafe"]):
        severity = "MEDIUM"
    else:
        severity = "LOW"

    return {
        "severity":      severity,
        "is_harassment": any(w in lower for w in ["harass", "follow", "uncomfortable"]),
        "tags":          [],
        "summary":       "Report received and queued for review.",
        "route_advice":  "SAFARA has noted this location. Safer alternatives will be prioritised.",
    }


def _parse_json(text: str) -> dict:
    """Strip markdown fences that the model might wrap around JSON."""
    cleaned = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    return json.loads(cleaned)


def _call_claude(text: str, location: str, api_key: str) -> dict:
    """
    Call the Anthropic Messages API and return the parsed classification dict.
    Raises an exception on network / parse errors — caller handles fallback.
    """
    payload = json.dumps({
        "model":      "claude-sonnet-4-20250514",
        "max_tokens": 400,
        "system":     _SYSTEM_PROMPT,
        "messages":   [{"role": "user", "content": f'Incident: "{text}"\nLocation: "{location}"'}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type":      "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key":         api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())

    return _parse_json(data["content"][0]["text"])


# ── Route ────────────────────────────────────────────────────────────────────

@ai_bp.route("/classify", methods=["POST"])
@auth_required
def classify():
    body     = request.json or {}
    text     = body.get("text", "")
    location = body.get("location", "")
    # Per-request key takes priority; fall back to server env var
    api_key  = body.get("apiKey", "").strip() or _ENV_API_KEY

    if not api_key:
        return jsonify(_keyword_fallback(text))

    try:
        result = _call_claude(text, location, api_key)
        return jsonify(result)
    except Exception as exc:
        # Don't let a Claude API failure break the report flow — degrade gracefully
        return jsonify({
            **_keyword_fallback(text),
            "_warning": f"Claude API unavailable ({exc}); used keyword fallback.",
        })
