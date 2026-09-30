from flask import Blueprint,jsonify
from app.db import query
bp=Blueprint('health',__name__)
@bp.get('/health')
def health():
    try:query('SELECT 1',one=True);return jsonify(status='ok',database='connected')
    except Exception:return jsonify(status='degraded',database='error'),503
@bp.get('')
def root():return jsonify(name='SAFARA API',version='v1',status='ok')
