from flask import Blueprint,jsonify,request
from app.security import officer
from app.db import query
from app.services.analytics import stats,score
bp=Blueprint('analytics',__name__)
@bp.get('/dashboard')
@officer
def dashboard():return jsonify(stats=stats(),safety_score=score())
@bp.get('/severity')
@officer
def severity():return jsonify(items=query("SELECT severity,COUNT(*) count FROM incidents GROUP BY severity ORDER BY FIELD(severity,'critical','high','medium','low')"))
@bp.get('/types')
@officer
def types():return jsonify(items=query('SELECT category,COUNT(*) count FROM incidents GROUP BY category ORDER BY count DESC'))
@bp.get('/trend')
@officer
def trend():
 try:d=max(1,min(365,int(request.args.get('days',30))))
 except (TypeError,ValueError):return jsonify(error='days must be an integer'),400
 return jsonify(items=query('SELECT DATE(created_at) day,COUNT(*) count FROM incidents WHERE created_at>=DATE_SUB(NOW(),INTERVAL %s DAY) GROUP BY DATE(created_at) ORDER BY day',(d,)))
@bp.get('/hotspots')
@officer
def hotspots():return jsonify(items=query("SELECT ROUND(latitude,3) lat,ROUND(longitude,3) lng,COUNT(*) incident_count FROM incidents WHERE status IN ('CONFIRMED','RESOLVED') GROUP BY ROUND(latitude,3),ROUND(longitude,3) ORDER BY incident_count DESC LIMIT 20"))
