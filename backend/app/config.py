import os
from dotenv import load_dotenv
load_dotenv()

def _int_env(name, default):
    raw = os.getenv(name, str(default))
    try: return int(raw)
    except (TypeError, ValueError): raise RuntimeError(f'{name} must be an integer')

class Settings:
    PORT = _int_env('PORT', 5000)
    JWT_SECRET = os.getenv('JWT_SECRET', '').strip()
    JWT_EXPIRES_MINUTES = _int_env('JWT_EXPIRES_MINUTES', 60)
    MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost').strip()
    MYSQL_PORT = _int_env('MYSQL_PORT', 3306)
    MYSQL_USER = os.getenv('MYSQL_USER', 'root').strip()
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
    MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'safara').strip()
    AI_PROVIDER = os.getenv('AI_PROVIDER', 'gemini').strip().lower()
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '').strip()
    GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash-lite').strip()
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
settings = Settings()

def ai_provider():
    return 'gemini' if settings.AI_PROVIDER == 'gemini' and settings.GEMINI_API_KEY else None
if not settings.JWT_SECRET: raise RuntimeError('JWT_SECRET is required in .env')
if len(settings.JWT_SECRET) < 32: raise RuntimeError('JWT_SECRET must be at least 32 characters')
if settings.JWT_EXPIRES_MINUTES < 5: raise RuntimeError('JWT_EXPIRES_MINUTES must be at least 5')
if settings.AI_PROVIDER != 'gemini': raise RuntimeError('SAFARA is configured to use Gemini. Set AI_PROVIDER=gemini')
