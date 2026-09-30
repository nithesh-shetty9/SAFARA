"""Statistics and health endpoints backed by MySQL."""

from datetime import datetime, timezone

from flask import Blueprint, jsonify

from database import get_db
from middleware import auth_required


stats_bp = Blueprint("stats", __name__, url_prefix="/api")


@stats_bp.route("/stats", methods=["GET"])
@auth_required
def stats():
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)

        cur.execute("SELECT COUNT(*) AS count FROM incidents")
        total = cur.fetchone()["count"]

        cur.execute("SELECT COUNT(*) AS count FROM incidents WHERE status = 'pending'")
        pending = cur.fetchone()["count"]

        cur.execute("SELECT COUNT(*) AS count FROM incidents WHERE status = 'confirmed'")
        confirmed = cur.fetchone()["count"]

        cur.execute("SELECT COUNT(*) AS count FROM incidents WHERE severity = 'HIGH'")
        high = cur.fetchone()["count"]

        cur.execute("SELECT COUNT(*) AS count FROM incidents WHERE is_harassment = TRUE")
        harassment = cur.fetchone()["count"]

        cur.execute("""
            SELECT location AS area, COUNT(*) AS count
            FROM incidents
            GROUP BY location
            ORDER BY count DESC
            LIMIT 5
        """)
        top_areas = cur.fetchall()
        cur.close()

    return jsonify({
        "total": total,
        "pending": pending,
        "confirmed": confirmed,
        "high_severity": high,
        "harassment": harassment,
        "top_areas": top_areas,
    })


@stats_bp.route("/health", methods=["GET"])
def health():
    try:
        with get_db() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT COUNT(*) AS users FROM users")
            users = cur.fetchone()["users"]
            cur.execute("SELECT COUNT(*) AS incidents FROM incidents")
            incidents = cur.fetchone()["incidents"]
            cur.close()
        return jsonify({
            "status": "ok",
            "database": "mysql",
            "ts": datetime.now(timezone.utc).isoformat(),
            "users": users,
            "incidents": incidents,
        })
    except Exception as exc:
        return jsonify({"status": "error", "database": "mysql", "error": str(exc)}), 503
