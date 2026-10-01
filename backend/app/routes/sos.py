from flask import Blueprint,request,jsonify,g
from app.db import query,execute
from app.security import auth
from app.utils import audit
bp=Blueprint('sos',__name__)
_SOS_FIELDS='id,latitude,longitude,address,status,created_at'
_OFFICER_ROLES=('NGO_OFFICER','GOV_OFFICER')
_ADMIN_ROLES=('SUPER_ADMIN','DISTRICT_ADMIN')
@bp.post('')
@auth
def create():
 d=request.get_json(silent=True)
 if not isinstance(d,dict):return jsonify(error='A JSON object is required'),400
 try:
  if isinstance(d.get('latitude'),bool) or isinstance(d.get('longitude'),bool):raise ValueError
  lat,lon=float(d['latitude']),float(d['longitude'])
  if not -90<=lat<=90 or not -180<=lon<=180:raise ValueError
 except (KeyError,TypeError,ValueError):return jsonify(error='Valid latitude and longitude are required'),400
 for f,limit in [('address',255),('message',5000)]:
  if d.get(f) is not None and (not isinstance(d[f],str) or len(d[f])>limit):return jsonify(error=f'{f} is invalid'),400
 sid,_=execute('INSERT INTO sos_alerts(user_id,latitude,longitude,address,message) VALUES(%s,%s,%s,%s,%s)',(g.current_user['id'],lat,lon,d.get('address'),d.get('message')));audit(g.current_user['id'],'SOS_CREATED','sos',sid);return jsonify(id=sid,status='ACTIVE'),201
@bp.get('')
@auth
def listing():
 role=g.current_user['role']
 if role=='USER':x=query(f'SELECT {_SOS_FIELDS} FROM sos_alerts WHERE user_id=%s ORDER BY created_at DESC',(g.current_user['id'],))
 elif role in _OFFICER_ROLES:x=query(f"SELECT {_SOS_FIELDS} FROM sos_alerts WHERE status IN ('ACTIVE','ACKNOWLEDGED') ORDER BY created_at DESC LIMIT 200")
 elif role in _ADMIN_ROLES:x=query(f'SELECT {_SOS_FIELDS} FROM sos_alerts ORDER BY created_at DESC LIMIT 200')
 else:return jsonify(error='Insufficient permissions'),403
 return jsonify(items=x)
@bp.patch('/<int:id>')
@auth
def update(id):
 d=request.get_json(silent=True);st=d.get('status') if isinstance(d,dict) else None
 row=query('SELECT id,user_id,status FROM sos_alerts WHERE id=%s',(id,),True)
 if not row:return jsonify(error='SOS alert not found'),404
 role=g.current_user['role']
 if role=='USER':
  if row['user_id']!=g.current_user['id']:return jsonify(error='Forbidden'),403
  if row['status']!='ACTIVE':return jsonify(error='Only an active SOS can be cancelled'),409
  if st!='CANCELLED':return jsonify(error='Users can only cancel an active SOS'),403
  execute('UPDATE sos_alerts SET status=%s,handled_by=%s,handled_at=NOW() WHERE id=%s',('CANCELLED',g.current_user['id'],id));audit(g.current_user['id'],'SOS_UPDATED','sos',id,{'status':'CANCELLED'});return jsonify(message='updated')
 if role in _OFFICER_ROLES:
  if row['status'] not in ('ACTIVE','ACKNOWLEDGED'):return jsonify(error='Only active or acknowledged SOS records can be handled'),409
  if st not in ('ACKNOWLEDGED','RESOLVED'):return jsonify(error='Officers may acknowledge or resolve SOS records'),403
 elif role not in _ADMIN_ROLES:return jsonify(error='Insufficient permissions'),403
 if st not in ['ACTIVE','ACKNOWLEDGED','RESOLVED','CANCELLED']:return jsonify(error='Invalid status'),400
 execute('UPDATE sos_alerts SET status=%s,handled_by=%s,handled_at=NOW() WHERE id=%s',(st,g.current_user['id'],id));audit(g.current_user['id'],'SOS_UPDATED','sos',id,{'status':st});return jsonify(message='updated')
