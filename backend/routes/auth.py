"""Authentication endpoints backed by MySQL."""

from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from database import (
    create_user,
    get_user_by_email,
    serialize_user,
    update_password_hash,
)
from middleware import create_token


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _valid_email(email):
    return "@" in email and "." in email.split("@")[-1]


@auth_bp.route("/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = get_user_by_email(email)
    if not user:
        return jsonify({"error": "Invalid email or password."}), 401

    stored = user.get("password_hash") or ""
    valid = False
    try:
        valid = check_password_hash(stored, password)
    except (ValueError, TypeError):
        valid = False

    # The three demo accounts created earlier may contain plain text passwords.
    # If so, accept them once and immediately upgrade them to a secure hash.
    if not valid and stored == password:
        valid = True
        new_hash = generate_password_hash(password)
        update_password_hash(user["id"], new_hash)
        user["password_hash"] = new_hash

    if not valid:
        return jsonify({"error": "Invalid email or password."}), 401

    if user.get("role") == "ngo" and user.get("status") == "pending":
        return jsonify({"error": "NGO application is pending admin approval."}), 403

    return jsonify({
        "token": create_token(user),
        "user": serialize_user(user),
    })


@auth_bp.route("/signup", methods=["POST"])
def signup():
    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    city = body.get("city", "").strip()

    if not name or not email or not password:
        return jsonify({"error": "name, email and password are required."}), 400
    if not _valid_email(email):
        return jsonify({"error": "Enter a valid email address."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if get_user_by_email(email):
        return jsonify({"error": "Email already registered."}), 409

    user = create_user(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="user",
        city=city,
        status="active",
    )

    return jsonify({
        "token": create_token(user),
        "user": serialize_user(user),
    }), 201


@auth_bp.route("/ngo-register", methods=["POST"])
def ngo_register():
    body = request.get_json(silent=True) or {}
    org = body.get("org", "").strip()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not org or not email or not password:
        return jsonify({"error": "org, email and password are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if get_user_by_email(email):
        return jsonify({"error": "Email already registered."}), 409

    create_user(
        name=org,
        email=email,
        password_hash=generate_password_hash(password),
        role="ngo",
        phone=body.get("phone", "").strip(),
        city=body.get("city", "").strip(),
        reg_id=body.get("regId", "").strip(),
        status="pending",
    )

    return jsonify({"message": "Application submitted. Pending admin approval."}), 201
