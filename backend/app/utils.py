import json
from flask import jsonify

def json_error(message,status=400): return jsonify(error=message),status

def audit(actor_id,action,entity_type,entity_id=None,details=None,commit=True):
    from app.db import execute
    return execute('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES(%s,%s,%s,%s,%s)',
        (actor_id,action,entity_type,entity_id,json.dumps(details or {})),commit=commit)

def audit_on(db,actor_id,action,entity_type,entity_id=None,details=None):
    with db.cursor() as c:
        c.execute('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES(%s,%s,%s,%s,%s)',
            (actor_id,action,entity_type,entity_id,json.dumps(details or {})))

def setting_int(key,default):
    from app.db import query
    row=query('SELECT setting_value FROM system_settings WHERE setting_key=%s',(key,),True)
    try: return int(row['setting_value']) if row else default
    except (TypeError,ValueError): return default
