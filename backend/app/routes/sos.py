from flask import Blueprint,request,jsonify,g
from app.db import query,execute
from app.security import auth,officer
from app.utils import audit
bp=Blueprint('sos',__name__)
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
 if g.current_user['role']=='USER':x=query('SELECT * FROM sos_alerts WHERE user_id=%s ORDER BY created_at DESC',(g.current_user['id'],))
 else:x=query('SELECT * FROM sos_alerts ORDER BY created_at DESC LIMIT 200')
 return jsonify(items=x)
@bp.patch('/<int:id>')
@officer
def update(id):
 d=request.get_json(silent=True);st=d.get('status') if isinstance(d,dict) else None
 if st not in ['ACTIVE','ACKNOWLEDGED','RESOLVED','CANCELLED']:return jsonify(error='Invalid status'),400
 if not query('SELECT id FROM sos_alerts WHERE id=%s',(id,),True):return jsonify(error='SOS alert not found'),404
 execute('UPDATE sos_alerts SET status=%s,handled_by=%s,handled_at=NOW() WHERE id=%s',(st,g.current_user['id'],id));audit(g.current_user['id'],'SOS_UPDATED','sos',id,{'status':st});return jsonify(message='updated')
