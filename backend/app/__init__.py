from flask import Flask,jsonify
from flask_cors import CORS
from app.config import settings
from app.db import close_db
from app.routes import register_routes

def create_app():
    app=Flask(__name__)
    app.config['JSON_SORT_KEYS']=False
    origins=[x.strip() for x in settings.CORS_ORIGINS.split(',') if x.strip()]
    if not origins: raise RuntimeError('CORS_ORIGINS must contain at least one origin')
    CORS(app,resources={r'/api/*':{'origins':origins}})
    app.teardown_appcontext(close_db)
    @app.errorhandler(404)
    def not_found(_): return jsonify(error='Resource not found'),404
    @app.errorhandler(405)
    def method_not_allowed(_): return jsonify(error='Method not allowed'),405
    @app.errorhandler(500)
    def server_error(_): return jsonify(error='Internal server error'),500
    register_routes(app)
    return app
