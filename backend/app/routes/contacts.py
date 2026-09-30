from flask import Blueprint,request,jsonify,g
from app.db import query,execute
from app.security import auth,admin
from app.utils import audit
bp=Blueprint('contacts',__name__)
@bp.get('')
@auth
def listing():return jsonify(items=query('SELECT * FROM emergency_contacts ORDER BY type,name'))
@bp.post('')
@admin
def create():
 d=request.get_json(silent=True)
 if not isinstance(d,dict) or not isinstance(d.get('name'),str) or not 1<=len(d['name'].strip())<=120 or not isinstance(d.get('phone'),str) or not 1<=len(d['phone'].strip())<=30:return jsonify(error='name and phone are required'),400
 for f,limit in [('organization',190),('type',50),('city',100)]:
  if d.get(f) is not None and (not isinstance(d[f],str) or len(d[f])>limit):return jsonify(error=f'{f} is invalid'),400
 cid,_=execute('INSERT INTO emergency_contacts(name,organization,phone,type,city) VALUES(%s,%s,%s,%s,%s)',(d['name'].strip(),d.get('organization'),d['phone'].strip(),d.get('type'),d.get('city')));audit(g.current_user['id'],'CONTACT_CREATED','emergency_contact',cid);return jsonify(id=cid),201
@bp.delete('/<int:id>')
@admin
def delete(id):
 if not query('SELECT id FROM emergency_contacts WHERE id=%s',(id,),True):return jsonify(error='Contact not found'),404
 execute('DELETE FROM emergency_contacts WHERE id=%s',(id,));audit(g.current_user['id'],'CONTACT_DELETED','emergency_contact',id);return jsonify(message='deleted')
