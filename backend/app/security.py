from functools import wraps
from datetime import datetime,timedelta,timezone
from flask import request,jsonify,g
import jwt
from werkzeug.security import generate_password_hash,check_password_hash
from app.config import settings
from app.db import query

def hash_password(p): return generate_password_hash(p)
def verify_password(p,h): return check_password_hash(h,p)
def token(u):
    now=datetime.now(timezone.utc)
    return jwt.encode({'sub':str(u['id']),'role':u['role'],'iat':now,'exp':now+timedelta(minutes=settings.JWT_EXPIRES_MINUTES)},settings.JWT_SECRET,algorithm='HS256')

def auth(fn):
    @wraps(fn)
    def w(*a,**k):
        h=request.headers.get('Authorization','')
        if not h.startswith('Bearer '):return jsonify(error='Authentication required'),401
        try:
            p=jwt.decode(h[7:].strip(),settings.JWT_SECRET,algorithms=['HS256'],options={'require':['sub','exp','iat']})
            uid=int(p['sub'])
            if uid<=0:raise ValueError
        except jwt.ExpiredSignatureError:return jsonify(error='Token expired'),401
        except (jwt.PyJWTError,ValueError,TypeError):return jsonify(error='Invalid token'),401
        u=query('SELECT id,name,email,phone,role,status,trust_score FROM users WHERE id=%s',(uid,),True)
        if not u or u['status']!='active':return jsonify(error='Account unavailable'),403
        g.current_user=u
        return fn(*a,**k)
    return w

def roles(*rs):
    def d(fn):
        @auth
        @wraps(fn)
        def w(*a,**k):
            if g.current_user['role'] not in rs:return jsonify(error='Insufficient permissions'),403
            return fn(*a,**k)
        return w
    return d
admin=roles('SUPER_ADMIN','DISTRICT_ADMIN')
officer=roles('SUPER_ADMIN','DISTRICT_ADMIN','NGO_OFFICER','GOV_OFFICER')
