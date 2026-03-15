"""
middleware.py
-------------
Authentication and authorisation decorators.

Usage:
    from middleware import auth_required, role_required

    @app.route("/api/something")
    @auth_required          # sets g.user; returns 401 if missing/invalid token
    def my_view():
        return g.user["name"]

    @app.route("/api/admin-only")
    @role_required("admin")  # 403 if role doesn't match
    def admin_view():
        ...

Token format (Bearer header):
    Authorization: Bearer <user_id>:<role>

This is intentionally simple — swap for JWT or session cookies in production.
"""

from functools import wraps
from flask import request, jsonify, g
from database import DATA


def auth_required(f):
    """Verify the Bearer token and attach the matching user to flask.g."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not token:
            return jsonify({"error": "Unauthorized — no token provided."}), 401
        try:
            uid, role = token.split(":", 1)
            user = next(
                (u for u in DATA["users"] if u["id"] == int(uid) and u["role"] == role),
                None,
            )
            if not user:
                return jsonify({"error": "Unauthorized — token invalid or user not found."}), 401
            g.user = user
        except (ValueError, AttributeError):
            return jsonify({"error": "Unauthorized — malformed token."}), 401
        return f(*args, **kwargs)
    return wrapper


def role_required(*roles):
    """
    Stack on top of @auth_required to restrict a route to specific roles.

    Example:
        @role_required("ngo", "admin")
        def verify_incident(): ...
    """
    def decorator(f):
        @wraps(f)
        @auth_required
        def wrapper(*args, **kwargs):
            if g.user["role"] not in roles:
                return jsonify({
                    "error": f"Forbidden — requires one of: {', '.join(roles)}."
                }), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator
