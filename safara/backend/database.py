"""
database.py
-----------
In-memory data store for SAFARA.
Replace DATA with a real SQLite/Postgres connection for production.
All modules import from here — never duplicate the data definition.
"""

DATA = {
    "users": [
        {"id": 1, "name": "Demo User", "email": "user@safara.in",  "pw": "user123",  "role": "user"},
        {"id": 2, "name": "City NGO",  "email": "ngo@safara.in",   "pw": "ngo123",   "role": "ngo"},
        {"id": 3, "name": "Admin",     "email": "admin@safara.in", "pw": "admin123", "role": "admin"},
    ],
    "incidents": [
        {"id": 1,  "type": "Harassment",          "location": "MG Road Station",         "lat": 12.9756, "lng": 77.6099, "severity": "HIGH",   "status": "confirmed", "ts": "2024-11-22T08:30:00", "userId": 1, "desc": "Verbal harassment near entrance",        "is_harassment": True},
        {"id": 2,  "type": "Suspicious Activity", "location": "Koramangala 5th Block",    "lat": 12.9352, "lng": 77.6245, "severity": "MEDIUM", "status": "confirmed", "ts": "2024-11-23T21:00:00", "userId": 1, "desc": "Person following commuter",              "is_harassment": False},
        {"id": 3,  "type": "Unsafe Environment",  "location": "Hebbal Flyover",           "lat": 13.0358, "lng": 77.5970, "severity": "LOW",    "status": "confirmed", "ts": "2024-11-24T19:00:00", "userId": 1, "desc": "No lighting on stretch",                 "is_harassment": False},
        {"id": 4,  "type": "Harassment",          "location": "Majestic Bus Stand",       "lat": 12.9772, "lng": 77.5710, "severity": "HIGH",   "status": "confirmed", "ts": "2024-11-20T22:10:00", "userId": 1, "desc": "Aggressive behaviour near bus bay",       "is_harassment": True},
        {"id": 5,  "type": "Theft / Snatching",   "location": "Brigade Road Junction",    "lat": 12.9716, "lng": 77.6069, "severity": "HIGH",   "status": "confirmed", "ts": "2024-11-21T20:45:00", "userId": 1, "desc": "Phone snatching incident",               "is_harassment": False},
        {"id": 6,  "type": "Suspicious Activity", "location": "Indiranagar 100ft Road",   "lat": 12.9784, "lng": 77.6408, "severity": "MEDIUM", "status": "confirmed", "ts": "2024-11-22T23:00:00", "userId": 1, "desc": "Man following women near metro",          "is_harassment": True},
        {"id": 7,  "type": "Unsafe Environment",  "location": "Shivajinagar Bus Stop",    "lat": 12.9849, "lng": 77.5998, "severity": "LOW",    "status": "confirmed", "ts": "2024-11-23T20:30:00", "userId": 1, "desc": "Poor lighting",                          "is_harassment": False},
        {"id": 8,  "type": "Harassment",          "location": "Silk Board Junction",      "lat": 12.9173, "lng": 77.6233, "severity": "HIGH",   "status": "confirmed", "ts": "2024-11-24T21:15:00", "userId": 1, "desc": "Harassment near signal",                 "is_harassment": True},
        {"id": 9,  "type": "Suspicious Activity", "location": "Banashankari Temple Road", "lat": 12.9255, "lng": 77.5614, "severity": "MEDIUM", "status": "confirmed", "ts": "2024-11-25T19:45:00", "userId": 1, "desc": "Suspicious vehicle following pedestrian", "is_harassment": False},
        {"id": 10, "type": "Theft / Snatching",   "location": "Jayanagar 4th Block",      "lat": 12.9299, "lng": 77.5800, "severity": "HIGH",   "status": "confirmed", "ts": "2024-11-25T21:00:00", "userId": 1, "desc": "Chain snatching reported",               "is_harassment": False},
        {"id": 11, "type": "Unsafe Environment",  "location": "Yeshwantpur Station",      "lat": 13.0206, "lng": 77.5520, "severity": "LOW",    "status": "confirmed", "ts": "2024-11-26T20:00:00", "userId": 1, "desc": "Unlit exit route",                       "is_harassment": False},
        {"id": 12, "type": "Harassment",          "location": "Whitefield ITPL Gate",     "lat": 12.9868, "lng": 77.7268, "severity": "MEDIUM", "status": "confirmed", "ts": "2024-11-26T22:30:00", "userId": 1, "desc": "Verbal abuse near gate 2",               "is_harassment": True},
    ],
    "next_id": 100,
}


def next_id() -> int:
    """Return a unique auto-incrementing ID and advance the counter."""
    nid = DATA["next_id"]
    DATA["next_id"] += 1
    return nid


def find_user_by_email(email: str) -> dict | None:
    return next((u for u in DATA["users"] if u["email"] == email), None)
