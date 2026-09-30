from .ai import ai_bp
from .auth import auth_bp
from .contacts import contacts_bp
from .incidents import incidents_bp
from .stats import stats_bp

__all__ = ["auth_bp", "incidents_bp", "ai_bp", "stats_bp", "contacts_bp"]
