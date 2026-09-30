from flask import Blueprint,request,jsonify,g
from time import monotonic
from app.db import query,execute,atomic
from app.security import auth,officer
from app.services.classification import classify,CATS,SEV
from app.utils import audit,audit_on,setting_int
bp=Blueprint('incidents',__name__)
_report_hits={}

def report_limited(uid):
    now=monotonic(); hits=[t for t in _report_hits.get(uid,[]) if now-t<3600]; limit=max(1,min(100,setting_int('max_reports_per_user_hour',5)))
    if len(hits)>=limit: _report_hits[uid]=hits; return True
    hits.append(now); _report_hits[uid]=hits; return False

def coords(d):
    try:
        if isinstance(d.get('latitude'),bool) or isinstance(d.get('longitude'),bool): raise ValueError
        lat,lon=float(d['latitude']),float(d['longitude'])
        if not -90<=lat<=90 or not -180<=lon<=180: raise ValueError
        return lat,lon
    except (KeyError,TypeError,ValueError): return None

@bp.post('')
@auth
def create():
    d=request.get_json(silent=True)
    if not isinstance(d,dict): return jsonify(error='A JSON object is required'),400
    if not isinstance(d.get('description'),str) or not 1<=len(d['description'].strip())<=5000: return jsonify(error='description is required and must be 1-5000 chars'),400
    if d.get('address') is not None and (not isinstance(d['address'],str) or len(d['address'])>255): return jsonify(error='address must be a string of at most 255 chars'),400
    c=coords(d)
    if not c:return jsonify(error='Valid latitude and longitude are required'),400
    if report_limited(g.current_user['id']): return jsonify(error='Hourly incident report limit reached'),429
    x=classify(d['description'])
    iid,_=execute("INSERT INTO incidents(reporter_id,description,latitude,longitude,address,category,severity,ai_category,ai_severity,ai_confidence,classification_source) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",(g.current_user['id'],d['description'].strip(),c[0],c[1],d.get('address'),x['category'],x['severity'],x['category'],x['severity'],x['confidence'],x['source']))
    audit(g.current_user['id'],'INCIDENT_CREATED','incident',iid,{'classification':x})
    return jsonify(incident=query('SELECT * FROM incidents WHERE id=%s',(iid,),True)),201

@bp.post('/classify')
@auth
def classify_route():
    d=request.get_json(silent=True)
    if not isinstance(d,dict) or not isinstance(d.get('description'),str) or not 1<=len(d['description'].strip())<=5000:return jsonify(error='description is required and must be 1-5000 chars'),400
    return jsonify(classify(d['description']))

@bp.get('')
@auth
def listing():
    clauses=[];p=[]
    if g.current_user['role']=='USER': clauses.append('reporter_id=%s');p.append(g.current_user['id'])
    allowed={'status':{'PENDING','ASSIGNED','UNDER_REVIEW','CONFIRMED','REJECTED','RESOLVED','ARCHIVED'},'severity':set(SEV),'category':set(CATS)}
    for k,a in allowed.items():
        v=request.args.get(k)
        if v:
            if v not in a:return jsonify(error=f'Invalid {k}'),400
            clauses.append(k+'=%s');p.append(v)
    search=request.args.get('search','').strip()
    if len(search)>100:return jsonify(error='search must be at most 100 chars'),400
    if search:clauses.append('(description LIKE %s OR address LIKE %s)');p += [f'%{search}%']*2
    try: limit=max(1,min(100,int(request.args.get('limit',100)))); offset=max(0,int(request.args.get('offset',0)))
    except ValueError:return jsonify(error='limit and offset must be integers'),400
    w=(' WHERE '+' AND '.join(clauses)) if clauses else ''
    return jsonify(items=query(f'SELECT * FROM incidents{w} ORDER BY created_at DESC LIMIT %s OFFSET %s',p+[limit,offset]))

@bp.get('/<int:id>')
@auth
def one(id):
    x=query('SELECT * FROM incidents WHERE id=%s',(id,),True)
    if not x:return jsonify(error='Incident not found'),404
    if g.current_user['role']=='USER' and x['reporter_id']!=g.current_user['id']:return jsonify(error='Forbidden'),403
    return jsonify(incident=x)

@bp.patch('/<int:id>/review')
@officer
def review(id):
    d=request.get_json(silent=True)
    if not isinstance(d,dict) or d.get('status') not in ['PENDING','ASSIGNED','UNDER_REVIEW','CONFIRMED','REJECTED','RESOLVED','ARCHIVED']:return jsonify(error='Invalid status'),400
    if d.get('review_note') is not None and (not isinstance(d['review_note'],str) or len(d['review_note'])>5000):return jsonify(error='review_note is invalid'),400
    if not query('SELECT id FROM incidents WHERE id=%s',(id,),True):return jsonify(error='Incident not found'),404
    execute('UPDATE incidents SET status=%s,reviewer_id=%s,review_note=%s,reviewed_at=NOW() WHERE id=%s',(d['status'],g.current_user['id'],d.get('review_note'),id));audit(g.current_user['id'],'INCIDENT_REVIEWED','incident',id,{'status':d['status']})
    return jsonify(incident=query('SELECT * FROM incidents WHERE id=%s',(id,),True))

@bp.patch('/<int:id>/classification')
@officer
def classification_update(id):
    d=request.get_json(silent=True)
    if not isinstance(d,dict) or d.get('category') not in CATS or d.get('severity') not in SEV:return jsonify(error='Valid category and severity are required'),400
    if not query('SELECT id FROM incidents WHERE id=%s',(id,),True):return jsonify(error='Incident not found'),404
    execute('UPDATE incidents SET category=%s,severity=%s,classification_source=\'ADMIN_CORRECTION\',reviewer_id=%s,reviewed_at=NOW() WHERE id=%s',(d['category'],d['severity'],g.current_user['id'],id))
    audit(g.current_user['id'],'INCIDENT_CLASSIFICATION_CORRECTED','incident',id,{'category':d['category'],'severity':d['severity']})
    return jsonify(incident=query('SELECT * FROM incidents WHERE id=%s',(id,),True))

@bp.post('/<int:id>/assign')
@officer
def assign(id):
    d=request.get_json(silent=True);uid=d.get('user_id') if isinstance(d,dict) else None
    if not query('SELECT id FROM incidents WHERE id=%s',(id,),True):return jsonify(error='Incident not found'),404
    if not isinstance(uid,int) or isinstance(uid,bool) or uid<=0:return jsonify(error='user_id must be a positive integer'),400
    if not query("SELECT id FROM users WHERE id=%s AND role IN ('NGO_OFFICER','GOV_OFFICER') AND status='active'",(uid,),True):return jsonify(error='Invalid officer'),400
    try:
        with atomic() as db:
            with db.cursor() as c:
                c.execute("UPDATE incident_assignments SET status='CANCELLED' WHERE incident_id=%s AND status='ACTIVE'",(id,))
                c.execute('INSERT INTO incident_assignments(incident_id,assignee_id,assigned_by) VALUES(%s,%s,%s)',(id,uid,g.current_user['id'])); assignment_id=c.lastrowid
                c.execute("UPDATE incidents SET status='ASSIGNED' WHERE id=%s",(id,))
            audit_on(db,g.current_user['id'],'INCIDENT_ASSIGNED','incident',id,{'assignee_id':uid,'assignment_id':assignment_id})
    except Exception:return jsonify(error='Could not assign incident'),500
    return jsonify(message='Assigned',assignment_id=assignment_id)
