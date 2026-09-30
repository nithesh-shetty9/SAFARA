from flask import Blueprint,jsonify,g
from app.security import roles
from app.db import query
bp=Blueprint('ngo',__name__)
@bp.get('/dashboard')
@roles('NGO_OFFICER','DISTRICT_ADMIN','SUPER_ADMIN')
def dashboard():return jsonify(assigned_incidents=query('SELECT i.*,ia.assigned_at FROM incidents i JOIN incident_assignments ia ON ia.incident_id=i.id WHERE ia.assignee_id=%s ORDER BY ia.assigned_at DESC',(g.current_user['id'],)),active_sos=query("SELECT * FROM sos_alerts WHERE status IN ('ACTIVE','ACKNOWLEDGED') ORDER BY created_at DESC"))
@bp.get('/profile')
@roles('NGO_OFFICER','DISTRICT_ADMIN','SUPER_ADMIN')
def profile():return jsonify(profile=query('SELECT * FROM ngo_profiles WHERE user_id=%s',(g.current_user['id'],),True))
