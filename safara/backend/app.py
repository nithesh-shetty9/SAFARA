"""
app.py
------
SAFARA — Flask application entry point.

This file only:
  1. Creates the Flask app
  2. Registers Blueprints
  3. Adds the static frontend fallback route
  4. Starts the dev server

All business logic lives in:
  database.py          — in-memory data store + helpers
  middleware.py        — auth_required / role_required decorators
  routes/auth.py       — POST /api/auth/*
  routes/incidents.py  — GET|POST|PATCH /api/incidents
  routes/ai.py         — POST /api/classify
  routes/stats.py      — GET /api/stats, GET /api/health

Run:
  python app.py
  # or
  flask --app app run --debug

Dependencies:
  pip install flask flask-cors
"""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS

from routes import auth_bp, incidents_bp, ai_bp, stats_bp

# ── App factory ───────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ── Register Blueprints ───────────────────────────────────────────────────────

app.register_blueprint(auth_bp)
app.register_blueprint(incidents_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(stats_bp)

# ── Frontend fallback — serves pages/ for direct browser navigation ───────────

_PAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "pages")

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    target = path or "login.html"
    try:
        return send_from_directory(_PAGES_DIR, target)
    except Exception:
        return send_from_directory(_PAGES_DIR, "login.html")


# ── Dev server ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🛡  SAFARA backend  →  http://localhost:5000")
    print("📂  Frontend pages  →  ../frontend/pages/")
    print("🔑  Set ANTHROPIC_API_KEY env var for live AI classification")
    app.run(debug=True, port=5000)
