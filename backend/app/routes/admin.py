from flask import Blueprint,request,jsonify,g
from app.db import query,execute,atomic
from app.security import admin
from app.services.analytics import stats,score
from app.utils import audit,audit_on
bp=Blueprint('admin',__name__)

@bp.get('/dashboard')
@admin
def dashboard(): return jsonify(stats=stats(),safety_score=score(),incidents=query('SELECT * FROM incidents ORDER BY created_at DESC LIMIT 20'),alerts=query('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 20'))
@bp.get('/users')
@admin
def users(): return jsonify(items=query('SELECT id,name,email,phone,role,status,trust_score,created_at FROM users ORDER BY created_at DESC'))
@bp.patch('/users/<int:id>/status')
@admin
def user_status(id):
    d=request.get_json(silent=True);st=d.get('status') if isinstance(d,dict) else None
    if st not in ['active','suspended','banned']:return jsonify(error='Invalid status'),400
    target=query('SELECT id,role,status FROM users WHERE id=%s',(id,),True)
    if not target:return jsonify(error='User not found'),404
    actor=g.current_user
    if target['id']==actor['id']:return jsonify(error='You cannot change your own status'),400
    if target['role'] in ('SUPER_ADMIN','DISTRICT_ADMIN') and actor['role']!='SUPER_ADMIN':return jsonify(error='Only a super admin can manage this administrator'),403
    execute('UPDATE users SET status=%s WHERE id=%s',(st,id));audit(actor['id'],'USER_STATUS_CHANGED','user',id,{'status':st});return jsonify(message='updated')

@bp.get('/ngo-applications')
@admin
def apps():return jsonify(items=query('SELECT a.*,u.name applicant_name,u.email applicant_email FROM ngo_applications a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC'))
@bp.patch('/ngo-applications/<int:id>')
@admin
def app_review(id):
    d=request.get_json(silent=True);st=d.get('status') if isinstance(d,dict) else None
    if st not in ['APPROVED','REJECTED']:return jsonify(error='Invalid status'),400
    a=query('SELECT * FROM ngo_applications WHERE id=%s',(id,),True)
    if not a:return jsonify(error='Application not found'),404
    if a['status']!='PENDING':return jsonify(error='Application has already been reviewed'),409
    note=d.get('review_note') if isinstance(d,dict) else None
    if note is not None and (not isinstance(note,str) or len(note)>5000):return jsonify(error='review_note is invalid'),400
    try:
        with atomic() as db:
            with db.cursor() as c:
                c.execute('UPDATE ngo_applications SET status=%s,reviewed_by=%s,review_note=%s,reviewed_at=NOW() WHERE id=%s',(st,g.current_user['id'],note,id))
                if st=='APPROVED':
                    c.execute("UPDATE users SET role='NGO_OFFICER' WHERE id=%s",(a['user_id'],))
                    c.execute('INSERT INTO ngo_profiles(user_id,organization_name,registration_number,description) VALUES(%s,%s,%s,%s) ON DUPLICATE KEY UPDATE organization_name=VALUES(organization_name),registration_number=VALUES(registration_number),description=VALUES(description)',(a['user_id'],a['organization_name'],a['registration_number'],a['description']))
            audit_on(db,g.current_user['id'],'NGO_APPLICATION_REVIEWED','ngo_application',id,{'status':st})
    except Exception:return jsonify(error='Could not review application'),500
    return jsonify(message='reviewed')

@bp.get('/officers')
@admin
def officers():return jsonify(items=query("SELECT id,name,email,role,status,trust_score FROM users WHERE role IN ('NGO_OFFICER','GOV_OFFICER') ORDER BY created_at DESC"))
@bp.get('/trust')
@admin
def trust():return jsonify(items=query('SELECT id,name,email,trust_score,status,(SELECT COUNT(*) FROM incidents i WHERE i.reporter_id=u.id) reports FROM users u ORDER BY trust_score'))

@bp.post('/alerts')
@admin
def alert():
    d=request.get_json(silent=True)
    if not isinstance(d,dict) or not isinstance(d.get('title'),str) or not 1<=len(d['title'].strip())<=190 or not isinstance(d.get('message'),str) or not 1<=len(d['message'].strip())<=10000:return jsonify(error='title and message are required'),400
    typ=d.get('type','system');sev=d.get('severity','medium')
    if typ not in ['critical','warning','system'] or sev not in ['low','medium','high','critical']:return jsonify(error='Invalid alert type or severity'),400
    aid,_=execute('INSERT INTO alerts(type,title,message,severity,created_by) VALUES(%s,%s,%s,%s,%s)',(typ,d['title'].strip(),d['message'].strip(),sev,g.current_user['id']));audit(g.current_user['id'],'ALERT_CREATED','alert',aid);return jsonify(id=aid),201
@bp.patch('/alerts/<int:id>/read')
@admin
def read(id):
    if not query('SELECT id FROM alerts WHERE id=%s',(id,),True):return jsonify(error='Alert not found'),404
    execute('UPDATE alerts SET is_read=1,read_by=%s,read_at=NOW() WHERE id=%s',(g.current_user['id'],id));audit(g.current_user['id'],'ALERT_READ','alert',id);return jsonify(message='read')
@bp.post('/protocols/<name>')
@admin
def protocol(name):
    if name not in ['patrol','broadcast','escalate']:return jsonify(error='Unknown protocol'),400
    try:
        with atomic() as db:
            with db.cursor() as c:
                c.execute('INSERT INTO emergency_protocol_events(protocol,triggered_by) VALUES(%s,%s)',(name,g.current_user['id']));eid=c.lastrowid
                c.execute("INSERT INTO alerts(type,title,message,severity,created_by) VALUES('critical',%s,%s,'critical',%s)",(name,'Emergency protocol triggered: '+name,g.current_user['id']))
            audit_on(db,g.current_user['id'],'EMERGENCY_PROTOCOL_TRIGGERED','protocol',eid,{'protocol':name})
    except Exception:return jsonify(error='Could not trigger protocol'),500
    return jsonify(id=eid),202
@bp.get('/audit-logs')
@admin
def audit_logs():return jsonify(items=query('SELECT a.*,u.name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200'))
