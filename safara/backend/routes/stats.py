"""
routes/stats.py
---------------
Read-only analytics and health endpoints:

  GET /api/stats   — dashboard counts + top incident areas  (auth required)
  GET /api/health  — simple uptime check (no auth)
"""

from datetime import datetime

from flask import Blueprint, jsonify
from database import DATA
from middleware import auth_required

stats_bp = Blueprint("stats", __name__, url_prefix="/api")


# ── GET /api/stats ───────────────────────────────────────────────────────────

@stats_bp.route("/stats", methods=["GET"])
@auth_required
def stats():
    incidents = DATA["incidents"]

    # Tally incidents per location
    by_area: dict[str, int] = {}
    for inc in incidents:
        by_area[inc["location"]] = by_area.get(inc["location"], 0) + 1

    top_areas = sorted(by_area.items(), key=lambda x: -x[1])[:5]

    return jsonify({
        "total":         len(incidents),
        "pending":       sum(1 for i in incidents if i["status"] == "pending"),
        "confirmed":     sum(1 for i in incidents if i["status"] == "confirmed"),
        "high_severity": sum(1 for i in incidents if i["severity"] == "HIGH"),
        "harassment":    sum(1 for i in incidents if i.get("is_harassment")),
        "top_areas":     [{"area": a, "count": c} for a, c in top_areas],
    })


# ── GET /api/health ──────────────────────────────────────────────────────────

@stats_bp.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "ts":     datetime.utcnow().isoformat(),
        "users":  len(DATA["users"]),
        "incidents": len(DATA["incidents"]),
    })
