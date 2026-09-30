from flask import Blueprint,request,jsonify,g
from app.db import query,execute
from app.security import admin
from app.config import ai_provider,settings
from app.utils import audit
bp=Blueprint('system',__name__)
ALLOWED={'escalation_threshold_hours':(1,720),'max_reports_per_user_hour':(1,100),'fake_report_auto_archive_hours':(1,8760),'alert_sensitivity':None}
@bp.get('/health-details')
@admin
def health_details():
    try: query('SELECT 1',one=True); db='connected'
    except Exception: db='error'
    return jsonify(api='ok',database=db,classification=ai_provider() or 'RULE_FALLBACK',model=settings.GEMINI_MODEL if ai_provider() else None)
@bp.get('/settings')
@admin
def get():return jsonify(items=query('SELECT setting_key,setting_value,description,updated_at FROM system_settings ORDER BY setting_key'))
@bp.patch('/settings')
@admin
def update():
    data=request.get_json(silent=True)
    if not isinstance(data,dict) or not data:return jsonify(error='A non-empty JSON object is required'),400
    for k,v in data.items():
        if k not in ALLOWED:return jsonify(error=f'Unknown setting: {k}'),400
        if not isinstance(v,(str,int,float)) or isinstance(v,bool):return jsonify(error=f'Invalid value for {k}'),400
        if k=='alert_sensitivity' and str(v) not in ('low','medium','high','critical'):return jsonify(error='Invalid alert_sensitivity'),400
        if ALLOWED[k] is not None:
            try:
                iv=int(v);lo,hi=ALLOWED[k]
                if iv<lo or iv>hi:raise ValueError
            except (TypeError,ValueError):return jsonify(error=f'Invalid value for {k}'),400
        execute('UPDATE system_settings SET setting_value=%s WHERE setting_key=%s',(str(v),k))
    audit(g.current_user['id'],'SYSTEM_SETTINGS_UPDATED','system_settings',None,{'keys':list(data)})
    return jsonify(message='updated')
