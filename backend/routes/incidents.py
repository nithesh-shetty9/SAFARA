"""Incident CRUD endpoints backed by MySQL."""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, g

from database import get_db, serialize_incident
from middleware import auth_required, role_required


incidents_bp = Blueprint("incidents", __name__, url_prefix="/api/incidents")
_PATCHABLE_FIELDS = {"status", "severity", "is_harassment"}
_VALID_SEVERITIES = {"LOW", "MEDIUM", "HIGH"}
_VALID_STATUSES = {"pending", "confirmed", "rejected"}


_SELECT = """
SELECT id, user_id, type, location, latitude, longitude,
       description, severity, status, is_harassment, reported_at
FROM incidents
"""


@incidents_bp.route("", methods=["GET"])
@auth_required
def get_incidents():
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        if g.user["role"] == "user":
            cur.execute(_SELECT + " WHERE status = 'confirmed' ORDER BY reported_at DESC")
        else:
            cur.execute(_SELECT + " ORDER BY reported_at DESC")
        rows = cur.fetchall()
        cur.close()

    return jsonify([serialize_incident(row) for row in rows])


@incidents_bp.route("", methods=["POST"])
@auth_required
def create_incident():
    body = request.get_json(silent=True) or {}

    incident_type = str(body.get("type", "")).strip()
    location = str(body.get("location", "")).strip()
    description = str(body.get("description", body.get("desc", ""))).strip()

    if not incident_type or not location:
        return jsonify({"error": "'type' and 'location' are required."}), 400

    # Accept both the old frontend names (lat/lng) and the new names.
    lat = body.get("latitude", body.get("lat"))
    lng = body.get("longitude", body.get("lng"))
    if lat is None or lng is None:
        return jsonify({"error": "latitude and longitude are required."}), 400

    try:
        lat = float(lat)
        lng = float(lng)
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid latitude or longitude."}), 400

    severity = str(body.get("severity", "LOW")).upper()
    if severity not in _VALID_SEVERITIES:
        return jsonify({"error": "severity must be LOW, MEDIUM or HIGH."}), 400

    is_harassment = bool(body.get("is_harassment", False))

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO incidents
               (user_id, type, location, latitude, longitude, description,
                severity, status, is_harassment)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s)""",
            (g.user["id"], incident_type, location, lat, lng,
             description, severity, is_harassment),
        )
        conn.commit()
        incident_id = cur.lastrowid
        cur.close()

    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute(_SELECT + " WHERE id = %s", (incident_id,))
        row = cur.fetchone()
        cur.close()

    return jsonify(serialize_incident(row)), 201


@incidents_bp.route("/<int:incident_id>", methods=["PATCH"])
@role_required("ngo", "admin")
def update_incident(incident_id):
    body = request.get_json(silent=True) or {}
    updates = []
    values = []

    for key in _PATCHABLE_FIELDS:
        if key not in body:
            continue
        value = body[key]
        if key == "severity":
            value = str(value).upper()
            if value not in _VALID_SEVERITIES:
                return jsonify({"error": "Invalid severity."}), 400
        elif key == "status":
            value = str(value).lower()
            if value not in _VALID_STATUSES:
                return jsonify({"error": "Invalid status."}), 400
        elif key == "is_harassment":
            value = bool(value)
        updates.append(f"{key} = %s")
        values.append(value)

    if not updates:
        return jsonify({"error": "No valid fields to update."}), 400

    values.append(incident_id)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE incidents SET {', '.join(updates)} WHERE id = %s",
            tuple(values),
        )
        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            return jsonify({"error": f"Incident {incident_id} not found."}), 404
        conn.commit()
        cur.close()

    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute(_SELECT + " WHERE id = %s", (incident_id,))
        row = cur.fetchone()
        cur.close()

    return jsonify(serialize_incident(row))
