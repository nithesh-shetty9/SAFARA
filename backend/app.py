"""SAFARA Flask backend — MySQL version."""

import os
from dotenv import load_dotenv

load_dotenv()
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from routes import auth_bp, incidents_bp, ai_bp, stats_bp, contacts_bp


BASE_DIR = os.path.dirname(__file__)
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]}},
)

app.register_blueprint(auth_bp)
app.register_blueprint(incidents_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(contacts_bp)


@app.route("/")
def root():
    return jsonify({
        "name": "SAFARA API",
        "status": "running",
        "database": "MySQL",
        "docs": "Use /api/health to test the backend",
    })


@app.route("/frontend/<path:path>")
def frontend_file(path):
    """Temporary route for the old frontend while React is being built."""
    return send_from_directory(FRONTEND_DIR, path)


if __name__ == "__main__":
    print("🛡 SAFARA API → http://localhost:5000")
    print("🗄 Database → MySQL / safara")
    app.run(debug=True, port=5000)
