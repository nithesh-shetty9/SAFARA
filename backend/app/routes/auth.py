from flask import Blueprint, request, jsonify, g
from time import monotonic
import re
from app.db import query, execute
from app.security import hash_password, verify_password, token, auth
from app.utils import audit
bp=Blueprint('auth',__name__)
_attempts={}; WINDOW=60; MAX_ATTEMPTS=10

def limited(key):
    now=monotonic(); hits=[t for t in _attempts.get(key,[]) if now-t<WINDOW]
    if len(hits)>=MAX_ATTEMPTS: _attempts[key]=hits; return True
    hits.append(now); _attempts[key]=hits; return False

def valid_name(v): return isinstance(v,str) and 1<=len(v.strip())<=120
def valid_email(v): return isinstance(v,str) and len(v.strip())<=190 and bool(re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+',v.strip()))

@bp.post('/register')
def register():
    if limited(f'reg:{request.remote_addr}'): return jsonify(error='Too many registration attempts; try again later'),429
    d=request.get_json(silent=True)
    if not isinstance(d,dict): return jsonify(error='A JSON object is required'),400
    name,email,password=d.get('name'),d.get('email'),d.get('password')
    if not valid_name(name) or not valid_email(email) or not isinstance(password,str) or not 8<=len(password)<=128:
        return jsonify(error='name, valid email and password of 8-128 chars are required'),400
    if d.get('phone') is not None and (not isinstance(d['phone'],str) or len(d['phone'])>30): return jsonify(error='phone must be a string of at most 30 chars'),400
    email=email.strip().lower()
    if query('SELECT id FROM users WHERE email=%s',(email,),True): return jsonify(error='Email already registered'),409
    uid,_=execute("INSERT INTO users(name,email,password_hash,phone,role,status) VALUES(%s,%s,%s,%s,'USER','active')",(name.strip(),email,hash_password(password),d.get('phone')))
    user=query('SELECT id,name,email,phone,role,status,trust_score FROM users WHERE id=%s',(uid,),True)
    audit(uid,'REGISTERED','user',uid)
    return jsonify(user=user,token=token(user)),201

@bp.post('/login')
def login():
    if limited(f'login:{request.remote_addr}'): return jsonify(error='Too many login attempts; try again later'),429
    d=request.get_json(silent=True)
    if not isinstance(d,dict) or not isinstance(d.get('email'),str) or not isinstance(d.get('password'),str): return jsonify(error='email and password must be strings'),400
    user=query('SELECT * FROM users WHERE email=%s',(d['email'].strip().lower(),),True)
    if not user or not verify_password(d['password'],user['password_hash']): return jsonify(error='Invalid email or password'),401
    if user['status']!='active': return jsonify(error='Account is not active'),403
    public={k:user[k] for k in ('id','name','email','phone','role','status','trust_score')}; audit(user['id'],'LOGIN','user',user['id'])
    return jsonify(user=public,token=token(user))

@bp.get('/me')
@auth
def me(): return jsonify(user=g.current_user)

@bp.post('/ngo/apply')
@auth
def ngo_apply():
    d=request.get_json(silent=True)
    if not isinstance(d,dict) or not isinstance(d.get('organization_name'),str) or not 1<=len(d['organization_name'].strip())<=190: return jsonify(error='organization_name is required and must be at most 190 chars'),400
    for f,limit in [('registration_number',100),('description',5000)]:
        if d.get(f) is not None and (not isinstance(d[f],str) or len(d[f])>limit): return jsonify(error=f'{f} must be a string of at most {limit} chars'),400
    if g.current_user['role']!='USER': return jsonify(error='Only regular users can submit an NGO application'),403
    if query("SELECT id FROM ngo_applications WHERE user_id=%s AND status='PENDING'",(g.current_user['id'],),True): return jsonify(error='Pending application already exists'),409
    aid,_=execute("INSERT INTO ngo_applications(user_id,organization_name,registration_number,description,status) VALUES(%s,%s,%s,%s,'PENDING')",(g.current_user['id'],d['organization_name'].strip(),d.get('registration_number'),d.get('description')))
    audit(g.current_user['id'],'NGO_APPLICATION_CREATED','ngo_application',aid)
    return jsonify(id=aid,status='PENDING'),201
