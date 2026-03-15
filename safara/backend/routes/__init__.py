# routes/__init__.py
# Exposes all Blueprints for registration in app.py
from .auth      import auth_bp
from .incidents import incidents_bp
from .ai        import ai_bp
from .stats     import stats_bp
