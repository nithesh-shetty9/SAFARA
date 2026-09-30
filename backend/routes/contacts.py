"""Emergency contact read endpoint backed by MySQL."""

from flask import Blueprint, jsonify

from database import get_db
from middleware import auth_required


contacts_bp = Blueprint("contacts", __name__, url_prefix="/api/contacts")


@contacts_bp.route("", methods=["GET"])
@auth_required
def get_contacts():
    with get_db() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """SELECT id, name, organization, phone, type, city
               FROM emergency_contacts
               ORDER BY name"""
        )
        contacts = cursor.fetchall()
        cursor.close()

    return jsonify(contacts)
