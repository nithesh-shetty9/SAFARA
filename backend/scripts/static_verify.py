from pathlib import Path
import ast,sys
ROOT=Path(__file__).resolve().parents[1]
fail=[]
def check(ok,msg):
    if ok: print('PASS',msg)
    else: print('FAIL',msg); fail.append(msg)
py=[p for p in ROOT.rglob('*.py') if '.venv' not in p.parts and '__pycache__' not in p.parts]
for p in py:
    try: ast.parse(p.read_text(),filename=str(p))
    except Exception as e: fail.append(f'{p}: {e}')
check(not any(':' in x for x in fail),'all Python files parse')
check(not (ROOT/'.env').exists(),'.env is not included')
check(not (ROOT/'.venv').exists(),'.venv is not included')
check(not any('__pycache__' in p.parts or p.suffix=='.pyc' for p in ROOT.rglob('*')),'no pycache/pyc files')
req=(ROOT/'requirements.txt').read_text()
check('google-genai' in req and 'openai' not in req,'Gemini-only dependencies')
config=(ROOT/'app/config.py').read_text()
check("AI_PROVIDER != 'gemini'" in config and 'GEMINI_MODEL' in config,'Gemini-only configuration')
check('gemini-2.5-flash-lite' in config,'stable Gemini model configured')
schema=(ROOT/'sql/schema.sql').read_text()
expected={'users','ngo_applications','ngo_profiles','incidents','incident_assignments','sos_alerts','emergency_contacts','alerts','emergency_protocol_events','audit_logs','system_settings'}
import re
actual=set(re.findall(r'CREATE TABLE IF NOT EXISTS (\w+)',schema))
check(actual==expected,f'expected 11 schema tables present ({len(actual)})')
required=[
'app.py','app/__init__.py','app/config.py','app/db.py','app/security.py','app/utils.py',
'app/routes/auth.py','app/routes/incidents.py','app/routes/admin.py','app/routes/ngo.py','app/routes/sos.py','app/routes/contacts.py','app/routes/analytics.py','app/routes/system.py','app/routes/health.py',
'app/services/classification.py','app/services/analytics.py','scripts/create_admin.py','sql/schema.sql','.env.example','.gitignore','requirements.txt','README.md']
check(all((ROOT/x).exists() for x in required),'required backend files present')
print(f'RESULT: {"PASS" if not fail else "FAIL"} ({len(fail)} failures)')
sys.exit(1 if fail else 0)
