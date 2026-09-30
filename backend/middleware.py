"""JWT authentication and role authorization for SAFARA."""

import os
from functools import wraps
from datetime import datetime, timezone

from dotenv import load_dotenv
import jwt
from flask import request, jsonify, g

from database import get_user_by_id, serialize_user


# Load environment variables from backend/.env
load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is missing. Add JWT_SECRET to the backend .env file."
    )

JWT_ALGORITHM = "HS256"


def create_token(user):
    payload = {
        "sub": str(user["id"]),
        "role": user["role"],
        "exp": datetime.now(timezone.utc).timestamp() + 8 * 60 * 60,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )


def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):

        header = request.headers.get("Authorization", "")

        if not header.startswith("Bearer "):
            return jsonify({
                "error": "Unauthorized — Bearer token required."
            }), 401

        token = header[7:].strip()

        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM]
            )

            user_id = int(payload["sub"])

        except (jwt.InvalidTokenError, ValueError, KeyError):
            return jsonify({
                "error": "Unauthorized — invalid or expired token."
            }), 401

        user = get_user_by_id(user_id)

        if not user:
            return jsonify({
                "error": "Unauthorized — user not found."
            }), 401

        if user.get("status") == "suspended":
            return jsonify({
                "error": "Account is suspended."
            }), 403

        g.user = user
        g.public_user = serialize_user(user)

        return f(*args, **kwargs)

    return wrapper


def role_required(*roles):

    def decorator(f):

        @wraps(f)
        @auth_required
        def wrapper(*args, **kwargs):

            if g.user["role"] not in roles:
                return jsonify({
                    "error": (
                        "Forbidden — requires one of: "
                        + ", ".join(roles)
                    )
                }), 403

            return f(*args, **kwargs)

        return wrapper

    return decorator