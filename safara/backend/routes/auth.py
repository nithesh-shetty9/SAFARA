"""
routes/auth.py
--------------
Authentication endpoints:

  POST /api/auth/login         — email + password → token
  POST /api/auth/signup        — register a commuter account
  POST /api/auth/ngo-register  — register an NGO (status: pending, needs admin approval)
"""

from flask import Blueprint, request, jsonify
from database import DATA, next_id, find_user_by_email

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _public_user(user: dict) -> dict:
    """Strip the password before sending a user object to the client."""
    return {k: v for k, v in user.items() if k != "pw"}


def _make_token(user: dict) -> str:
    """Build a simple Bearer token: '<id>:<role>'."""
    return f"{user['id']}:{user['role']}"


# ── Login ────────────────────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    body  = request.json or {}
    email = body.get("email", "").strip()
    pw    = body.get("password", "")

    user = next(
        (u for u in DATA["users"] if u["email"] == email and u["pw"] == pw),
        None,
    )
    if not user:
        return jsonify({"error": "Invalid email or password."}), 401

    return jsonify({"token": _make_token(user), "user": _public_user(user)})


# ── Commuter signup ──────────────────────────────────────────────────────────

@auth_bp.route("/signup", methods=["POST"])
def signup():
    body  = request.json or {}
    name  = body.get("name", "").strip()
    email = body.get("email", "").strip()
    pw    = body.get("password", "")
    city  = body.get("city", "").strip()

    if not name or not email or not pw:
        return jsonify({"error": "name, email and password are required."}), 400
    if find_user_by_email(email):
        return jsonify({"error": "Email already registered."}), 409
    if len(pw) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    user = {
        "id":   next_id(),
        "name": name,
        "email": email,
        "pw":   pw,
        "city": city,
        "role": "user",
    }
    DATA["users"].append(user)
    return jsonify({"token": _make_token(user), "user": _public_user(user)}), 201


# ── NGO / Authority registration ─────────────────────────────────────────────

@auth_bp.route("/ngo-register", methods=["POST"])
def ngo_register():
    body  = request.json or {}
    org   = body.get("org", "").strip()
    email = body.get("email", "").strip()
    pw    = body.get("password", "")

    if not org or not email or not pw:
        return jsonify({"error": "org, email and password are required."}), 400
    if find_user_by_email(email):
        return jsonify({"error": "Email already registered."}), 409

    user = {
        "id":     next_id(),
        "name":   org,
        "email":  email,
        "pw":     pw,
        "phone":  body.get("phone", ""),
        "city":   body.get("city", ""),
        "reg_id": body.get("regId", ""),
        "role":   "ngo",
        "status": "pending",   # admin must approve before access is granted
    }
    DATA["users"].append(user)
    return jsonify({"message": "Application submitted. Pending admin approval."}), 201
