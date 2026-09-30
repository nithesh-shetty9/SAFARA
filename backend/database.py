"""MySQL database layer for SAFARA."""

import os
from contextlib import contextmanager

from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error

# Load variables from backend/.env
load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "safara"),
}


@contextmanager
def get_db():
    """Open a MySQL connection and always close it."""
    conn = None

    try:
        conn = mysql.connector.connect(**DB_CONFIG)

        if not conn.is_connected():
            raise RuntimeError("Could not connect to MySQL")

        yield conn

    except Error as exc:
        raise RuntimeError(f"MySQL error: {exc}") from exc

    finally:
        if conn and conn.is_connected():
            conn.close()


def get_user_by_id(user_id):
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT * FROM users WHERE id = %s",
            (user_id,)
        )
        user = cur.fetchone()
        cur.close()
        return user


def get_user_by_email(email):
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT * FROM users WHERE email = %s",
            (email,)
        )
        user = cur.fetchone()
        cur.close()
        return user


def create_user(
    name,
    email,
    password_hash,
    role="user",
    city="",
    phone="",
    reg_id="",
    status="active"
):
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """INSERT INTO users
               (name, email, password_hash, role, city, phone, reg_id, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                name,
                email,
                password_hash,
                role,
                city,
                phone,
                reg_id,
                status,
            ),
        )

        conn.commit()
        user_id = cur.lastrowid
        cur.close()

        return get_user_by_id(user_id)


def update_password_hash(user_id, password_hash):
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (password_hash, user_id),
        )

        conn.commit()
        cur.close()


def serialize_user(user):
    if not user:
        return None

    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "city": user.get("city"),
        "phone": user.get("phone"),
        "reg_id": user.get("reg_id"),
        "status": user.get("status", "active"),
        "created_at": user.get("created_at"),
    }


def serialize_incident(row):
    """Return DB fields plus legacy names expected by the current frontend."""

    if not row:
        return None

    return {
        "id": row["id"],
        "userId": row["user_id"],
        "type": row["type"],
        "location": row["location"],
        "lat": row["latitude"],
        "lng": row["longitude"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "desc": row.get("description") or "",
        "description": row.get("description") or "",
        "severity": row["severity"],
        "status": row["status"],
        "is_harassment": bool(row.get("is_harassment")),
        "ts": row.get("reported_at").isoformat()
        if row.get("reported_at")
        else None,
        "reported_at": row.get("reported_at").isoformat()
        if row.get("reported_at")
        else None,
    }