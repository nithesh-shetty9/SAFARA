"""
routes/incidents.py
-------------------
Incident CRUD endpoints:

  GET   /api/incidents       — list incidents
                               • regular users  → confirmed only
                               • ngo / admin    → all
  POST  /api/incidents       — submit a new incident (any authenticated user)
  PATCH /api/incidents/<id>  — update status / severity (ngo & admin only)
"""

import random
from datetime import datetime

from flask import Blueprint, request, jsonify, g
from database import DATA, next_id
from middleware import auth_required, role_required

incidents_bp = Blueprint("incidents", __name__, url_prefix="/api/incidents")

# Fields that NGO / admin are allowed to modify
_PATCHABLE_FIELDS = {"status", "severity", "is_harassment"}


# ── GET /api/incidents ───────────────────────────────────────────────────────

@incidents_bp.route("", methods=["GET"])
@auth_required
def get_incidents():
    incidents = DATA["incidents"]

    # Regular commuters only see verified / confirmed reports
    if g.user["role"] == "user":
        incidents = [i for i in incidents if i["status"] == "confirmed"]

    return jsonify(incidents)


# ── POST /api/incidents ──────────────────────────────────────────────────────

@incidents_bp.route("", methods=["POST"])
@auth_required
def create_incident():
    body = request.json or {}

    # Validate required fields
    for field in ("type", "location"):
        if not body.get(field):
            return jsonify({"error": f"'{field}' is required."}), 400

    incident = {
        "id":            next_id(),
        "type":          body["type"],
        "location":      body["location"].strip(),
        "desc":          body.get("desc", "").strip(),
        "ts":            body.get("ts", datetime.utcnow().isoformat()),
        "userId":        g.user["id"],
        "severity":      body.get("severity", "LOW"),
        "is_harassment": bool(body.get("is_harassment", False)),
        "status":        "pending",
        # Use provided coords if available; otherwise scatter around Bengaluru centre
        "lat":           body.get("lat", 12.9716 + (random.random() - 0.5) * 0.08),
        "lng":           body.get("lng", 77.5946 + (random.random() - 0.5) * 0.08),
    }
    DATA["incidents"].append(incident)
    return jsonify(incident), 201


# ── PATCH /api/incidents/<id> ────────────────────────────────────────────────

@incidents_bp.route("/<int:incident_id>", methods=["PATCH"])
@role_required("ngo", "admin")
def update_incident(incident_id):
    body = request.json or {}

    idx = next(
        (i for i, inc in enumerate(DATA["incidents"]) if inc["id"] == incident_id),
        None,
    )
    if idx is None:
        return jsonify({"error": f"Incident {incident_id} not found."}), 404

    # Only allow whitelisted fields to be changed
    for key, value in body.items():
        if key in _PATCHABLE_FIELDS:
            DATA["incidents"][idx][key] = value

    return jsonify(DATA["incidents"][idx])
