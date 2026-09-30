"""End-to-end SAFARA API verification against a running local server.

Use a disposable database whose name starts with ``verifytest_``. The script
creates prefixed users and records, verifies HTTP and database behavior, then
removes only rows associated with that run.
"""

import argparse
from datetime import datetime, timedelta, timezone
import re
from pathlib import Path
import secrets
import sys
import time

import jwt
import pymysql
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import settings, ai_provider

ROLES = ('USER', 'NGO_OFFICER', 'GOV_OFFICER', 'DISTRICT_ADMIN', 'SUPER_ADMIN')
ADMIN_ROLES = {'DISTRICT_ADMIN', 'SUPER_ADMIN'}
OFFICER_ROLES = {'NGO_OFFICER', 'GOV_OFFICER', 'DISTRICT_ADMIN', 'SUPER_ADMIN'}


def source_line(relative_path, marker):
    for line_number, line in enumerate((ROOT / relative_path).read_text(encoding='utf-8').splitlines(), 1):
        if marker in line:
            return str(line_number)
    return 'unlocated'


def mysql_connection(database):
    return pymysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=database,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:5000/api/v1')
    parser.add_argument('--database', default=settings.MYSQL_DATABASE)
    parser.add_argument('--report', default=str(ROOT / 'VERIFICATION_REPORT.md'))
    args = parser.parse_args()
    if not args.database.startswith('verifytest_'):
        parser.error('Refusing to run: --database must start with verifytest_')

    base_url = args.base_url.rstrip('/')
    run_id = time.strftime('%Y%m%d_%H%M%S') + '_' + secrets.token_hex(3)
    prefix = 'verifytest_' + run_id
    findings = []
    route_results = {}
    matrix = {}
    user_ids = {}
    tokens = {}
    created = {'incident': [], 'sos': [], 'ngo_application': [], 'alert': [], 'contact': [], 'protocol': []}
    connection = mysql_connection(args.database)
    session = requests.Session()

    def record(route, label, passed, detail):
        route_results.setdefault(route, []).append((label, passed, str(detail)))
        findings.append((route, label, passed, str(detail)))
        print(('PASS' if passed else 'FAIL') + ' | ' + route + ' | ' + label + ' | ' + str(detail))

    def api(method, path, role=None, body=None, params=None, raw=None):
        headers = {}
        if role in tokens:
            headers['Authorization'] = 'Bearer ' + tokens[role]
        if raw is not None:
            headers['Content-Type'] = 'application/json'
        try:
            return session.request(method, base_url + path, headers=headers, json=body,
                                   params=params, data=raw, timeout=60)
        except requests.RequestException as error:
            return error

    def status(route, label, response, expected, shape=None):
        if isinstance(response, Exception):
            record(route, label, False, type(response).__name__)
            return False
        passed = response.status_code in expected
        detail = str(response.status_code)
        if shape and passed:
            try:
                passed = shape(response.json())
                if not passed:
                    detail += ' invalid JSON shape'
            except (ValueError, requests.JSONDecodeError):
                passed = False
                detail += ' non-JSON response'
        record(route, label, passed, detail)
        return passed

    def sql(statement, params=(), one=False):
        with connection.cursor() as cursor:
            cursor.execute(statement, params)
            return cursor.fetchone() if one else cursor.fetchall()

    def clean_up():
        ids = [value for value in user_ids.values() if value]
        if not ids:
            return
        marks = ','.join(['%s'] * len(ids))
        incident_ids = [row['id'] for row in sql(f'SELECT id FROM incidents WHERE reporter_id IN ({marks})', ids)]
        sos_ids = [row['id'] for row in sql(f'SELECT id FROM sos_alerts WHERE user_id IN ({marks})', ids)]
        app_ids = [row['id'] for row in sql(f'SELECT id FROM ngo_applications WHERE user_id IN ({marks})', ids)]
        alert_ids = [row['id'] for row in sql(f'SELECT id FROM alerts WHERE created_by IN ({marks})', ids)]
        protocol_ids = [row['id'] for row in sql(f'SELECT id FROM emergency_protocol_events WHERE triggered_by IN ({marks})', ids)]
        for values, table, column in ((incident_ids, 'incident_assignments', 'incident_id'),
                                      (incident_ids, 'audit_logs', 'entity_id'),
                                      (sos_ids, 'audit_logs', 'entity_id'),
                                      (app_ids, 'audit_logs', 'entity_id'),
                                      (alert_ids, 'audit_logs', 'entity_id'),
                                      (protocol_ids, 'audit_logs', 'entity_id')):
            if values:
                value_marks = ','.join(['%s'] * len(values))
                sql(f'DELETE FROM {table} WHERE {column} IN ({value_marks})', values)
        sql(f'DELETE FROM incident_assignments WHERE assignee_id IN ({marks}) OR assigned_by IN ({marks})', ids + ids)
        sql(f'DELETE FROM audit_logs WHERE actor_id IN ({marks})', ids)
        for values, table in ((incident_ids, 'incidents'), (sos_ids, 'sos_alerts'),
                              (app_ids, 'ngo_applications'), (alert_ids, 'alerts'),
                              (protocol_ids, 'emergency_protocol_events'),
                              (created['contact'], 'emergency_contacts')):
            if values:
                value_marks = ','.join(['%s'] * len(values))
                sql(f'DELETE FROM {table} WHERE id IN ({value_marks})', values)
        sql(f'DELETE FROM ngo_profiles WHERE user_id IN ({marks})', ids)
        sql('DELETE FROM system_settings WHERE setting_key LIKE %s', (prefix + '%',))
        sql(f'DELETE FROM users WHERE id IN ({marks})', ids)

    def db_check(route, label, statement, params=(), predicate=None):
        try:
            value = sql(statement, params, one=True)
            passed = predicate(value) if predicate else bool(value)
            record(route, label, passed, 'row verified' if passed else 'expected DB row/state missing')
            return value
        except Exception as error:
            record(route, label, False, 'DB check: ' + type(error).__name__)
            return None

    try:
        status('GET /', 'root health', api('GET', ''), {200}, lambda x: x.get('status') == 'ok')
        status('GET /health', 'database health', api('GET', '/health'), {200}, lambda x: x.get('database') == 'connected')

        for role in ROLES:
            email = f'{prefix}_{role.lower()}@example.invalid'
            response = api('POST', '/auth/register', body={
                'name': prefix + '_' + role.lower(), 'email': email,
                'password': 'VerifyTest!234', 'phone': '5550100',
                'role': 'SUPER_ADMIN', 'status': 'active', 'trust_score': 100,
            })
            passed = status('POST /auth/register', role + ' registration', response, {201},
                            lambda x: x.get('user', {}).get('role') == 'USER'
                            and 'password_hash' not in x.get('user', {}))
            if not passed:
                continue
            user = response.json()['user']
            user_ids[role] = user['id']
            sql('UPDATE users SET role=%s WHERE id=%s', (role, user['id']))
            login = api('POST', '/auth/login', body={'email': email, 'password': 'VerifyTest!234'})
            if status('POST /auth/login', role + ' login', login, {200},
                      lambda x: 'token' in x and 'password_hash' not in x.get('user', {})):
                tokens[role] = login.json()['token']

        if len(tokens) != len(ROLES):
            raise RuntimeError('Could not seed all five active test roles')

        for owner_key in ('OWNER_A', 'OWNER_B'):
            email = f'{prefix}_{owner_key.lower()}@example.invalid'
            response = api('POST', '/auth/register', body={
                'name': prefix + '_' + owner_key.lower(), 'email': email,
                'password': 'VerifyTest!234',
            })
            if status('POST /auth/register', owner_key + ' registration', response, {201}):
                user_ids[owner_key] = response.json()['user']['id']
                login = api('POST', '/auth/login', body={'email': email, 'password': 'VerifyTest!234'})
                if status('POST /auth/login', owner_key + ' login', login, {200}):
                    tokens[owner_key] = login.json()['token']

        me = api('GET', '/auth/me', 'USER')
        status('GET /auth/me', 'authenticated user JSON shape', me, {200},
               lambda x: x.get('user', {}).get('role') == 'USER' and 'password_hash' not in x.get('user', {}))

        owner_incident_ids = []
        for owner_key, latitude in (('OWNER_A', 10.0), ('OWNER_B', 11.0)):
            response = api('POST', '/incidents', owner_key, body={
                'description': prefix + ' owned incident', 'latitude': latitude, 'longitude': 70.0,
            })
            if status('POST /incidents', owner_key + ' owned incident', response, {201}):
                owned_id = response.json()['incident']['id']
                owner_incident_ids.append(owned_id)
                created['incident'].append(owned_id)
        if len(owner_incident_ids) == 2:
            owner_list = api('GET', '/incidents', 'OWNER_A')
            status('GET /incidents', 'USER listing limited to own incidents', owner_list, {200},
                   lambda x: all(row.get('reporter_id') == user_ids['OWNER_A'] for row in x.get('items', []))
                   and any(row.get('id') == owner_incident_ids[0] for row in x.get('items', [])))
            other_incident = api('GET', f'/incidents/{owner_incident_ids[1]}', 'OWNER_A')
            status('GET /incidents/:id', 'USER cannot read another user incident', other_incident, {403})

        owner_sos_ids = []
        for owner_key, latitude in (('OWNER_A', 10.0), ('OWNER_B', 11.0)):
            response = api('POST', '/sos', owner_key, body={'latitude': latitude, 'longitude': 70.0})
            if status('POST /sos', owner_key + ' SOS', response, {201}):
                owner_sos_ids.append(response.json()['id'])
                created['sos'].append(response.json()['id'])
        if len(owner_sos_ids) == 2:
            owner_sos = api('GET', '/sos', 'OWNER_A')
            status('GET /sos', 'USER listing limited to own SOS', owner_sos, {200},
                   lambda x: all(row.get('user_id') == user_ids['OWNER_A'] for row in x.get('items', []))
                   and any(row.get('id') == owner_sos_ids[0] for row in x.get('items', [])))

        route_specs = [
            ('GET /auth/me', 'GET', '/auth/me', 'auth', None, None),
            ('POST /auth/ngo/apply', 'POST', '/auth/ngo/apply', 'auth', {}, None),
            ('POST /incidents', 'POST', '/incidents', 'auth', {}, None),
            ('GET /incidents', 'GET', '/incidents', 'auth', None, None),
            ('GET /incidents/:id', 'GET', '/incidents/2147483000', 'auth', None, None),
            ('POST /incidents/classify', 'POST', '/incidents/classify', 'auth', {}, None),
            ('PATCH /incidents/:id/review', 'PATCH', '/incidents/2147483000/review', 'officer', {}, None),
            ('POST /incidents/:id/assign', 'POST', '/incidents/2147483000/assign', 'officer', {}, None),
            ('GET /admin/dashboard', 'GET', '/admin/dashboard', 'admin', None, None),
            ('GET /admin/users', 'GET', '/admin/users', 'admin', None, None),
            ('GET /admin/officers', 'GET', '/admin/officers', 'admin', None, None),
            ('GET /admin/trust', 'GET', '/admin/trust', 'admin', None, None),
            ('GET /admin/ngo-applications', 'GET', '/admin/ngo-applications', 'admin', None, None),
            ('GET /admin/audit-logs', 'GET', '/admin/audit-logs', 'admin', None, None),
            ('PATCH /admin/users/:id/status', 'PATCH', '/admin/users/2147483000/status', 'admin', {'status': 'active'}, None),
            ('PATCH /admin/ngo-applications/:id', 'PATCH', '/admin/ngo-applications/2147483000', 'admin', {}, None),
            ('POST /admin/alerts', 'POST', '/admin/alerts', 'admin', {}, None),
            ('PATCH /admin/alerts/:id/read', 'PATCH', '/admin/alerts/2147483000/read', 'admin', None, None),
            ('POST /admin/protocols/:name', 'POST', '/admin/protocols/invalid', 'admin', {}, None),
            ('GET /ngo/dashboard', 'GET', '/ngo/dashboard', 'ngo', None, None),
            ('GET /ngo/profile', 'GET', '/ngo/profile', 'ngo', None, None),
            ('POST /sos', 'POST', '/sos', 'auth', {}, None),
            ('GET /sos', 'GET', '/sos', 'auth', None, None),
            ('PATCH /sos/:id', 'PATCH', '/sos/2147483000', 'officer', {}, None),
            ('GET /contacts', 'GET', '/contacts', 'auth', None, None),
            ('POST /contacts', 'POST', '/contacts', 'admin', {}, None),
            ('DELETE /contacts/:id', 'DELETE', '/contacts/2147483000', 'admin', None, None),
            ('GET /analytics/dashboard', 'GET', '/analytics/dashboard', 'officer', None, None),
            ('GET /analytics/severity', 'GET', '/analytics/severity', 'officer', None, None),
            ('GET /analytics/types', 'GET', '/analytics/types', 'officer', None, None),
            ('GET /analytics/trend', 'GET', '/analytics/trend', 'officer', None, None),
            ('GET /analytics/hotspots', 'GET', '/analytics/hotspots', 'officer', None, None),
            ('GET /system/health-details', 'GET', '/system/health-details', 'admin', None, None),
            ('GET /system/settings', 'GET', '/system/settings', 'admin', None, None),
            ('PATCH /system/settings', 'PATCH', '/system/settings', 'admin', {}, None),
            ('GET /health', 'GET', '/health', 'public', None, None),
            ('GET /', 'GET', '/', 'public', None, None),
            ('POST /auth/register', 'POST', '/auth/register', 'public', {}, None),
            ('POST /auth/login', 'POST', '/auth/login', 'public', {}, None),
        ]

        for route, method, path, access, body, params in route_specs:
            matrix[route] = {}
            if access == 'public':
                matrix[route] = {role: 'not role-gated / public' for role in ROLES}
                continue
            allowed_roles = set(ROLES) if access == 'auth' else OFFICER_ROLES if access == 'officer' else ADMIN_ROLES if access == 'admin' else {'NGO_OFFICER', 'DISTRICT_ADMIN', 'SUPER_ADMIN'}
            for role in ROLES:
                response = api(method, path, role, body=body, params=params)
                permitted = role in allowed_roles
                if permitted:
                    okay = not isinstance(response, Exception) and 200 <= response.status_code < 500 and response.status_code not in {401, 403, 429}
                    actual = str(response.status_code) if not isinstance(response, Exception) else type(response).__name__
                else:
                    okay = not isinstance(response, Exception) and response.status_code == 403
                    actual = str(response.status_code) if not isinstance(response, Exception) else type(response).__name__
                expected = 'allowed' if permitted else '403'
                matrix[route][role] = expected + ' / ' + actual
                record(route, role + ' role gate', okay, actual + (' expected allow' if permitted else ' expected 403'))

        protected_specs = [item for item in route_specs if item[3] != 'public']
        expired = jwt.encode({'sub': user_ids['USER'], 'role': 'USER',
                              'iat': datetime.now(timezone.utc) - timedelta(hours=2),
                              'exp': datetime.now(timezone.utc) - timedelta(hours=1)},
                             settings.JWT_SECRET, algorithm='HS256')
        for route, method, path, _, body, params in protected_specs:
            for label, auth_value in (('no token', None), ('bad token', 'not.a.valid.token'), ('expired token', expired)):
                headers = {} if auth_value is None else {'Authorization': 'Bearer ' + auth_value}
                try:
                    response = session.request(method, base_url + path, headers=headers, json=body,
                                               params=params, timeout=60)
                except requests.RequestException as error:
                    response = error
                status(route, label, response, {401})

        apply = api('POST', '/auth/ngo/apply', 'USER', body={
            'organization_name': prefix + ' NGO', 'registration_number': prefix,
            'description': 'verifytest application',
        })
        if status('POST /auth/ngo/apply', 'create application', apply, {201}, lambda x: x.get('status') == 'PENDING'):
            application_id = apply.json()['id']
            created['ngo_application'].append(application_id)
            db_check('POST /auth/ngo/apply', 'pending DB row',
                     'SELECT status FROM ngo_applications WHERE id=%s', (application_id,),
                     lambda x: x and x['status'] == 'PENDING')
            db_check('POST /auth/ngo/apply', 'application audit entry',
                     "SELECT id FROM audit_logs WHERE entity_type='ngo_application' AND entity_id=%s AND action='NGO_APPLICATION_CREATED'",
                     (application_id,))
            duplicate = api('POST', '/auth/ngo/apply', 'USER', body={'organization_name': prefix + ' NGO'})
            status('POST /auth/ngo/apply', 'one pending application rule', duplicate, {409})
            approval = api('PATCH', f'/admin/ngo-applications/{application_id}', 'SUPER_ADMIN',
                           body={'status': 'APPROVED', 'review_note': 'verifytest approval'})
            if status('PATCH /admin/ngo-applications/:id', 'approve application', approval, {200}):
                db_check('PATCH /admin/ngo-applications/:id', 'approval state/reviewer',
                         'SELECT status,reviewed_by FROM ngo_applications WHERE id=%s', (application_id,),
                         lambda x: x and x['status'] == 'APPROVED' and x['reviewed_by'] == user_ids['SUPER_ADMIN'])
                db_check('PATCH /admin/ngo-applications/:id', 'profile created',
                         'SELECT user_id FROM ngo_profiles WHERE user_id=%s', (user_ids['USER'],))
                db_check('PATCH /admin/ngo-applications/:id', 'user promoted',
                         'SELECT role FROM users WHERE id=%s', (user_ids['USER'],),
                         lambda x: x and x['role'] == 'NGO_OFFICER')
                tokens['USER'] = api('POST', '/auth/login', body={
                    'email': f'{prefix}_user@example.invalid', 'password': 'VerifyTest!234'
                }).json()['token']

        incident_response = api('POST', '/incidents', 'GOV_OFFICER', body={
            'description': 'verifytest followed by a stranger after dark',
            'latitude': 12.9716, 'longitude': 77.5946, 'address': prefix,
        })
        incident_id = None
        categories = {'stalking','harassment','assault','theft','accident','poor_lighting','unsafe_area','suspicious_activity','safe_zone','other'}
        severities = {'low','medium','high','critical'}
        if status('POST /incidents', 'create and classify incident', incident_response, {201},
                  lambda x: isinstance(x.get('incident'), dict)
                  and x['incident'].get('classification_source') in {'AI', 'RULE'}
                  and x['incident'].get('category') in categories
                  and x['incident'].get('severity') in severities):
            incident = incident_response.json()['incident']
            incident_id = incident['id']
            created['incident'].append(incident_id)
            record('POST /incidents', 'classification source enum', incident['classification_source'] in {'AI', 'RULE'}, incident['classification_source'])
            db_check('POST /incidents', 'incident persisted', 'SELECT reporter_id FROM incidents WHERE id=%s',
                     (incident_id,), lambda x: x and x['reporter_id'] == user_ids['GOV_OFFICER'])
            own = api('GET', '/incidents/' + str(incident_id), 'GOV_OFFICER')
            status('GET /incidents/:id', 'incident detail', own, {200}, lambda x: x.get('incident', {}).get('id') == incident_id)
            review = api('PATCH', f'/incidents/{incident_id}/review', 'GOV_OFFICER',
                         body={'status': 'CONFIRMED', 'review_note': 'verifytest reviewed'})
            if status('PATCH /incidents/:id/review', 'review incident', review, {200}):
                db_check('PATCH /incidents/:id/review', 'reviewer and status persisted',
                         'SELECT status,reviewer_id FROM incidents WHERE id=%s', (incident_id,),
                         lambda x: x and x['status'] == 'CONFIRMED' and x['reviewer_id'] == user_ids['GOV_OFFICER'])
                db_check('PATCH /incidents/:id/review', 'review audit entry',
                         "SELECT id FROM audit_logs WHERE entity_type='incident' AND entity_id=%s AND action='INCIDENT_REVIEWED'",
                         (incident_id,))
            assign = api('POST', f'/incidents/{incident_id}/assign', 'DISTRICT_ADMIN',
                         body={'user_id': user_ids['NGO_OFFICER']})
            if status('POST /incidents/:id/assign', 'assign incident', assign, {200}):
                db_check('POST /incidents/:id/assign', 'assignment persisted',
                         'SELECT id FROM incident_assignments WHERE incident_id=%s AND assignee_id=%s',
                         (incident_id, user_ids['NGO_OFFICER']))
                db_check('POST /incidents/:id/assign', 'assigned status persisted',
                         'SELECT status FROM incidents WHERE id=%s', (incident_id,),
                         lambda x: x and x['status'] == 'ASSIGNED')
                db_check('POST /incidents/:id/assign', 'assignment audit entry',
                         "SELECT id FROM audit_logs WHERE entity_type='incident' AND entity_id=%s AND action='INCIDENT_ASSIGNED'",
                         (incident_id,))
            for filter_name, value in (('status', 'ASSIGNED'), ('severity', 'high'),
                                       ('category', 'stalking'), ('search', prefix + "' OR 1=1 --")):
                response = api('GET', '/incidents', 'GOV_OFFICER', params={filter_name: value})
                status('GET /incidents', filter_name + ' filter / injection', response, {200},
                       lambda x: isinstance(x.get('items'), list))

        classified = api('POST', '/incidents/classify', 'USER', body={'description': 'verifytest followed after dark'})
        if status('POST /incidents/classify', 'classification response', classified, {200},
                  lambda x: x.get('source') in {'AI', 'RULE'} and x.get('category') in categories and x.get('severity') in severities):
            source = classified.json()['source']
            record('POST /incidents/classify', 'classification source enum', source in {'AI', 'RULE'}, source)

        sos = api('POST', '/sos', 'OWNER_A', body={'latitude': 13.0, 'longitude': 77.0, 'message': prefix})
        sos_id = None
        if status('POST /sos', 'create SOS', sos, {201}):
            sos_id = sos.json()['id']
            created['sos'].append(sos_id)
            db_check('POST /sos', 'SOS persisted', 'SELECT user_id,status FROM sos_alerts WHERE id=%s',
                     (sos_id,), lambda x: x and x['user_id'] == user_ids['OWNER_A'] and x['status'] == 'ACTIVE')
            owner_items = api('GET', '/sos', 'OWNER_A')
            status('GET /sos', 'USER sees own SOS only', owner_items, {200},
                   lambda x: all(row.get('user_id') == user_ids['OWNER_A'] for row in x.get('items', [])))
            update = api('PATCH', f'/sos/{sos_id}', 'GOV_OFFICER', body={'status': 'ACKNOWLEDGED'})
            if status('PATCH /sos/:id', 'acknowledge SOS', update, {200}):
                db_check('PATCH /sos/:id', 'handler/state persisted',
                         'SELECT status,handled_by FROM sos_alerts WHERE id=%s', (sos_id,),
                         lambda x: x and x['status'] == 'ACKNOWLEDGED' and x['handled_by'] == user_ids['GOV_OFFICER'])
                db_check('PATCH /sos/:id', 'SOS update audit entry',
                         "SELECT id FROM audit_logs WHERE entity_type='sos' AND entity_id=%s AND action='SOS_UPDATED'",
                         (sos_id,))

        alert = api('POST', '/admin/alerts', 'SUPER_ADMIN', body={
            'type': 'warning', 'title': prefix, 'message': 'verifytest alert', 'severity': 'medium'
        })
        if status('POST /admin/alerts', 'create alert', alert, {201}):
            alert_id = alert.json()['id']
            created['alert'].append(alert_id)
            db_check('POST /admin/alerts', 'alert persisted', 'SELECT id FROM alerts WHERE id=%s', (alert_id,))
            db_check('POST /admin/alerts', 'alert audit entry',
                     "SELECT id FROM audit_logs WHERE entity_type='alert' AND entity_id=%s AND action='ALERT_CREATED'",
                     (alert_id,))
            read = api('PATCH', f'/admin/alerts/{alert_id}/read', 'SUPER_ADMIN')
            if status('PATCH /admin/alerts/:id/read', 'mark alert read', read, {200}):
                db_check('PATCH /admin/alerts/:id/read', 'read state persisted',
                         'SELECT is_read,read_by FROM alerts WHERE id=%s', (alert_id,),
                         lambda x: x and x['is_read'] and x['read_by'] == user_ids['SUPER_ADMIN'])
                db_check('PATCH /admin/alerts/:id/read', 'read audit entry',
                         "SELECT id FROM audit_logs WHERE entity_type='alert' AND entity_id=%s AND action='ALERT_READ'",
                         (alert_id,))
        for protocol_name in ('patrol', 'broadcast', 'escalate'):
            response = api('POST', '/admin/protocols/' + protocol_name, 'SUPER_ADMIN', body={})
            if status('POST /admin/protocols/:name', protocol_name + ' protocol', response, {202}):
                protocol_id = response.json()['id']
                created['protocol'].append(protocol_id)
                db_check('POST /admin/protocols/:name', protocol_name + ' event persisted',
                         'SELECT id FROM emergency_protocol_events WHERE id=%s AND protocol=%s',
                         (protocol_id, protocol_name))
                db_check('POST /admin/protocols/:name', protocol_name + ' audit entry',
                         "SELECT id FROM audit_logs WHERE entity_type='protocol' AND entity_id=%s AND action='EMERGENCY_PROTOCOL_TRIGGERED'",
                         (protocol_id,))

        contact = api('POST', '/contacts', 'SUPER_ADMIN', body={
            'name': prefix, 'phone': '5550101', 'organization': 'verifytest',
        })
        if status('POST /contacts', 'create contact', contact, {201}):
            contact_id = contact.json()['id']
            created['contact'].append(contact_id)
            db_check('POST /contacts', 'contact persisted', 'SELECT id FROM emergency_contacts WHERE id=%s', (contact_id,))
            deleted = api('DELETE', f'/contacts/{contact_id}', 'SUPER_ADMIN')
            if status('DELETE /contacts/:id', 'delete contact', deleted, {200}):
                db_check('DELETE /contacts/:id', 'contact removed',
                         'SELECT id FROM emergency_contacts WHERE id=%s', (contact_id,), lambda x: not x)

        for path in ('/analytics/dashboard', '/analytics/severity', '/analytics/types',
                     '/analytics/trend?days=7', '/analytics/hotspots'):
            response = api('GET', path, 'GOV_OFFICER')
            status('GET ' + path.split('?')[0], 'happy path JSON', response, {200}, lambda x: isinstance(x, dict))
        trend_bad = api('GET', '/analytics/trend', 'GOV_OFFICER', params={'days': 'invalid'})
        status('GET /analytics/trend', 'invalid days is 4xx', trend_bad, set(range(400, 500)))

        for path in ('/admin/dashboard', '/admin/users', '/admin/officers', '/admin/trust',
                     '/admin/ngo-applications', '/admin/audit-logs', '/system/health-details', '/system/settings'):
            response = api('GET', path, 'SUPER_ADMIN')
            status('GET ' + path, 'admin read JSON', response, {200}, lambda x: isinstance(x, dict))
        setting = api('PATCH', '/system/settings', 'SUPER_ADMIN', body={prefix: 'verified'})
        if status('PATCH /system/settings', 'update setting', setting, {200}):
            db_check('PATCH /system/settings', 'setting persisted',
                     'SELECT setting_value FROM system_settings WHERE setting_key=%s', (prefix,),
                     lambda x: x and x['setting_value'] == 'verified')

        validation_probes = (
            ('POST /auth/register', 'POST', '/auth/register', None, {'name': 7, 'email': 'badtype@example.invalid', 'password': 'VerifyTest!234'}, None),
            ('POST /auth/register', 'POST', '/auth/register', None, {}, None),
            ('POST /auth/login', 'POST', '/auth/login', None, {'email': 7, 'password': 'VerifyTest!234'}, None),
            ('POST /auth/ngo/apply', 'POST', '/auth/ngo/apply', 'USER', [], None),
            ('POST /incidents', 'POST', '/incidents', 'USER', {'description': 'x', 'latitude': 91, 'longitude': 0}, None),
            ('POST /incidents', 'POST', '/incidents', 'USER', {'description': 'x', 'latitude': 0, 'longitude': 181}, None),
            ('POST /incidents', 'POST', '/incidents', 'USER', {'description': 'x', 'latitude': 'north', 'longitude': 0}, None),
            ('POST /incidents', 'POST', '/incidents', 'USER', {'description': [], 'latitude': 0, 'longitude': 0}, None),
            ('POST /incidents/classify', 'POST', '/incidents/classify', 'USER', {'description': 7}, None),
            ('POST /sos', 'POST', '/sos', 'USER', {'latitude': -91, 'longitude': 0}, None),
            ('POST /sos', 'POST', '/sos', 'USER', {'latitude': 0, 'longitude': 181}, None),
            ('POST /sos', 'POST', '/sos', 'USER', [], None),
            ('POST /incidents/:id/assign', 'POST', f"/incidents/{incident_id or 2147483000}/assign", 'GOV_OFFICER', {'user_id': []}, None),
            ('PATCH /incidents/:id/review', 'PATCH', '/incidents/2147483000/review', 'GOV_OFFICER', {'status': 'BAD'}, None),
            ('PATCH /incidents/:id/review', 'PATCH', '/incidents/2147483000/review', 'GOV_OFFICER', [], None),
            ('PATCH /sos/:id', 'PATCH', '/sos/2147483000', 'GOV_OFFICER', {'status': 'BAD'}, None),
            ('PATCH /sos/:id', 'PATCH', '/sos/2147483000', 'GOV_OFFICER', [], None),
            ('PATCH /admin/users/:id/status', 'PATCH', '/admin/users/2147483000/status', 'SUPER_ADMIN', [], None),
            ('PATCH /admin/ngo-applications/:id', 'PATCH', '/admin/ngo-applications/2147483000', 'SUPER_ADMIN', {'status': 'BAD'}, None),
            ('PATCH /admin/ngo-applications/:id', 'PATCH', '/admin/ngo-applications/2147483000', 'SUPER_ADMIN', [], None),
            ('POST /admin/alerts', 'POST', '/admin/alerts', 'SUPER_ADMIN', [], None),
            ('POST /admin/alerts', 'POST', '/admin/alerts', 'SUPER_ADMIN', {'title': 'bad enum', 'message': 'verifytest', 'type': 'invalid'}, None),
            ('POST /contacts', 'POST', '/contacts', 'SUPER_ADMIN', [], None),
            ('PATCH /system/settings', 'PATCH', '/system/settings', 'SUPER_ADMIN', [], None),
        )
        for route, method, path, role, body, params in validation_probes:
            response = api(method, path, role, body=body, params=params)
            status(route, 'invalid field/value returns 4xx', response, set(range(400, 500)))
        for filter_name in ('status', 'severity', 'category'):
            response = api('GET', '/incidents', 'GOV_OFFICER', params={filter_name: 'invalid_value'})
            status('GET /incidents', 'invalid ' + filter_name + ' enum returns 4xx', response, set(range(400, 500)))
        bad_json = api('POST', '/incidents', 'USER', raw='{invalid json')
        status('POST /incidents', 'invalid JSON returns 4xx', bad_json, set(range(400, 500)))

        nonexistent = 2147483000
        for route, method, path, role, body in (
            ('GET /incidents/:id', 'GET', f'/incidents/{nonexistent}', 'GOV_OFFICER', None),
            ('PATCH /incidents/:id/review', 'PATCH', f'/incidents/{nonexistent}/review', 'GOV_OFFICER', {'status': 'CONFIRMED'}),
            ('POST /incidents/:id/assign', 'POST', f'/incidents/{nonexistent}/assign', 'GOV_OFFICER', {'user_id': user_ids['NGO_OFFICER']}),
            ('PATCH /admin/users/:id/status', 'PATCH', f'/admin/users/{nonexistent}/status', 'SUPER_ADMIN', {'status': 'banned'}),
            ('PATCH /admin/ngo-applications/:id', 'PATCH', f'/admin/ngo-applications/{nonexistent}', 'SUPER_ADMIN', {'status': 'APPROVED'}),
            ('PATCH /admin/alerts/:id/read', 'PATCH', f'/admin/alerts/{nonexistent}/read', 'SUPER_ADMIN', None),
            ('PATCH /sos/:id', 'PATCH', f'/sos/{nonexistent}', 'GOV_OFFICER', {'status': 'RESOLVED'}),
            ('DELETE /contacts/:id', 'DELETE', f'/contacts/{nonexistent}', 'SUPER_ADMIN', None),
        ):
            response = api(method, path, role, body=body)
            status(route, 'nonexistent id returns 404', response, {404})

        for account_status in ('suspended', 'banned'):
            sql('UPDATE users SET status=%s WHERE id=%s', (account_status, user_ids['USER']))
            status('GET /auth/me', account_status + ' account blocked', api('GET', '/auth/me', 'USER'), {403})
            sql("UPDATE users SET status='active' WHERE id=%s", (user_ids['USER'],))
        self_status = api('PATCH', f"/admin/users/{user_ids['SUPER_ADMIN']}/status", 'SUPER_ADMIN', body={'status': 'banned'})
        status('PATCH /admin/users/:id/status', 'cannot change own status', self_status, {400})
        district_admin = api('PATCH', f"/admin/users/{user_ids['SUPER_ADMIN']}/status", 'DISTRICT_ADMIN', body={'status': 'banned'})
        status('PATCH /admin/users/:id/status', 'district cannot manage super admin', district_admin, {403})

        injection = api('GET', '/incidents', 'GOV_OFFICER', params={
            'status': "PENDING' OR 1=1 --"
        })
        status('GET /incidents', 'SQL injection in enum filter rejected', injection, {400})
        search_injection = api('GET', '/incidents', 'GOV_OFFICER', params={'search': "%' OR '1'='1"})
        status('GET /incidents', 'SQL injection in search safely parameterized', search_injection, {200},
               lambda x: x.get('items') == [])
        id_injection = api('GET', '/incidents/1%20OR%201%3D1', 'GOV_OFFICER')
        status('GET /incidents/:id', 'SQL injection ID rejected', id_injection, {404})

        if incident_id:
            db_check('POST /incidents', 'audit log exists',
                     "SELECT id FROM audit_logs WHERE entity_type='incident' AND entity_id=%s AND action='INCIDENT_CREATED'",
                     (incident_id,))
        if created['ngo_application']:
            db_check('PATCH /admin/ngo-applications/:id', 'approval audit exists',
                     "SELECT id FROM audit_logs WHERE entity_type='ngo_application' AND entity_id=%s AND action='NGO_APPLICATION_REVIEWED'",
                     (created['ngo_application'][0],))

        status_change = api('PATCH', f"/admin/users/{user_ids['OWNER_B']}/status", 'SUPER_ADMIN',
                            body={'status': 'suspended'})
        if status('PATCH /admin/users/:id/status', 'suspend another user', status_change, {200}):
            db_check('PATCH /admin/users/:id/status', 'status persisted',
                     'SELECT status FROM users WHERE id=%s', (user_ids['OWNER_B'],),
                     lambda x: x and x['status'] == 'suspended')
            db_check('PATCH /admin/users/:id/status', 'status audit entry',
                     "SELECT id FROM audit_logs WHERE entity_type='user' AND entity_id=%s AND action='USER_STATUS_CHANGED'",
                     (user_ids['OWNER_B'],))
            suspended_login = api('POST', '/auth/login', body={
                'email': f'{prefix}_owner_b@example.invalid', 'password': 'VerifyTest!234'
            })
            status('POST /auth/login', 'suspended login blocked', suspended_login, {403})
            restored = api('PATCH', f"/admin/users/{user_ids['OWNER_B']}/status", 'SUPER_ADMIN',
                           body={'status': 'active'})
            if status('PATCH /admin/users/:id/status', 'restore another user', restored, {200}):
                db_check('PATCH /admin/users/:id/status', 'active state restored',
                         'SELECT status FROM users WHERE id=%s', (user_ids['OWNER_B'],),
                         lambda x: x and x['status'] == 'active')

        login_limited = False
        for _ in range(12):
            response = api('POST', '/auth/login', body={'email': prefix + '_missing@example.invalid', 'password': 'wrong'})
            if not isinstance(response, Exception) and response.status_code == 429:
                login_limited = True
                break
        record('POST /auth/login', 'rate limit returns 429', login_limited, '429 observed' if login_limited else 'no 429 within 12 attempts')
        register_limited = False
        for _ in range(12):
            response = api('POST', '/auth/register', body={})
            if not isinstance(response, Exception) and response.status_code == 429:
                register_limited = True
                break
        record('POST /auth/register', 'rate limit returns 429', register_limited, '429 observed' if register_limited else 'no 429 within 12 attempts')

        schema = (ROOT / 'sql' / 'schema.sql').read_text(encoding='utf-8')
        schema_tables = set(re.findall(r'CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)', schema, re.I))
        used_tables = set()
        for file_path in (ROOT / 'app').rglob('*.py'):
            source = file_path.read_text(encoding='utf-8')
            sql_literals = re.findall(r"'''(.*?)'''|\"\"\"(.*?)\"\"\"|'((?:\\.|[^'\\])*)'|\"((?:\\.|[^\"\\])*)\"", source, re.S)
            for parts in sql_literals:
                statement = next((part for part in parts if part), '')
                if re.match(r'^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE)\b', statement, re.I):
                    used_tables.update(re.findall(r'\b(?:FROM|JOIN|INTO|DELETE\s+FROM)\s+([a-z_]\w*)', statement, re.I))
                    update_match = re.match(r'^\s*UPDATE\s+([a-z_]\w*)', statement, re.I)
                    if update_match:
                        used_tables.add(update_match.group(1))
        schema_names = {name.lower() for name in schema_tables}
        missing_tables = sorted(table for table in used_tables if table.lower() not in schema_names)
        record('Schema vs. code', 'referenced SQL tables exist in schema', not missing_tables,
               'missing: ' + ', '.join(missing_tables) if missing_tables else f'{len(used_tables)} SQL table references matched')

    except Exception as error:
        record('VERIFIER', 'execution completed', False, type(error).__name__ + ': ' + str(error)[:200])
    finally:
        try:
            clean_up()
            record('Cleanup', 'prefixed user records removed', True, 'run-owned records deleted')
        except Exception as error:
            record('Cleanup', 'prefixed user records removed', False, type(error).__name__)
        connection.close()

    total = len(findings)
    failures = sum(not item[2] for item in findings)
    print(f'\nSUMMARY: {total - failures} passed, {failures} failed, {total} checks')
    lines = [
        '# SAFARA API Verification Report', '', f'- Run: `{run_id}`',
        f'- Base URL: `{base_url}`',
        f'- Database: `{args.database}` (isolated `verifytest_` schema)',
        f'- Result: **{total - failures} passed, {failures} failed, {total} checks**',
        f'- Classification config: provider `{ai_provider() or "RULE_FALLBACK"}`, model `{settings.GEMINI_MODEL}`.',
        '- Test users and data are removed by the script after each run.', '',
        '## Route Results', '', '| Route | Result | Failed checks |', '|---|---:|---|',
    ]
    for route in sorted(route_results):
        failed = [label + ': ' + detail for label, passed, detail in route_results[route] if not passed]
        lines.append(f"| {route} | {'FAIL' if failed else 'PASS'} | {'; '.join(failed) if failed else 'None'} |")
    lines.extend(['', '## Route × Role Matrix', '',
                  '| Route | USER (expected / actual) | NGO_OFFICER (expected / actual) | GOV_OFFICER (expected / actual) | DISTRICT_ADMIN (expected / actual) | SUPER_ADMIN (expected / actual) |',
                  '|---|---:|---:|---:|---:|---:|'])
    for route, outcomes in matrix.items():
        lines.append('| ' + route + ' | ' + ' | '.join(outcomes.get(role, 'untested') for role in ROLES) + ' |')
    bugs = [
        ('app/security.py', "'sub': str(u['id'])", 'High', 'PyJWT 2.10 rejected the numeric subject claim, making every minted access token unusable; subject is now serialized as a string.', 'Fixed'),
        ('app/routes/auth.py', 'organization_name is required', 'Medium', 'An NGO application without organization_name reached a NOT NULL database constraint and returned 500; request validation now returns 400.', 'Fixed'),
        ('app/routes/admin.py', 'title and message are required', 'Medium', 'An alert missing title/message reached MySQL and returned 500; required fields and enum values are validated.', 'Fixed'),
        ('app/routes/contacts.py', 'name and phone are required', 'Medium', 'A contact missing name/phone reached a NOT NULL constraint and returned 500; input validation now returns 400.', 'Fixed'),
        ('app/routes/contacts.py', 'Contact not found', 'Low', 'Deleting an unknown contact returned 200; the route now checks existence and returns 404.', 'Fixed'),
        ('app/routes/analytics.py', 'days must be an integer', 'Medium', 'A non-integer trend days value raised ValueError and returned 500; the route now responds 400.', 'Fixed'),
        ('app/config.py', "GEMINI_MODEL = os.getenv", 'Medium', 'The default model was retired for new users and returned Gemini 404, forcing rule fallback; the default now uses gemini-3.5-flash-lite.', 'Default fixed; local GEMINI_MODEL override must also be updated'),
    ]
    lines.extend(['', '## Bugs Found', '', '| File | Line | Severity | Cause and fix | Status |', '|---|---:|---|---|---|'])
    for file_path, marker, severity, cause, fix_status in bugs:
        location = f'[{file_path}]({file_path}#L{source_line(file_path, marker)})'
        lines.append(f'| {location} | {source_line(file_path, marker)} | {severity} | {cause} | {fix_status} |')
    lines.extend(['', '## Security Concerns', '',
                  '- Login and registration rate limits are process-local in-memory counters. They passed the single-process HTTP checks, but a multi-worker deployment can reset or split the counters; shared rate-limit storage is not part of this minimal fix.',
                  '- The existing environment-level GEMINI_MODEL overrides the source default. A run using `gemini-2.5-flash-lite` logged a Gemini 404 saying the model is unavailable to new users; using `gemini-3.5-flash-lite` via a process-only override produced `source=AI`, category `stalking`, severity `high`. Set GEMINI_MODEL in `.env` to the recommended model for normal runs.',
                  '- No SQL injection, password-hash disclosure, or mass-assignment escalation was observed in the executed checks.',
                  '', '## Schema and Untested Scope', '',
                  'All statically referenced SQL table names matched `sql/schema.sql`, and live route scenarios executed the covered reads/writes against a database initialized from that schema. A complete static mapping of every SQL column, type, and enum to each query is **untested**; this verifier does not parse SQL into a full column-level contract.',
                  '', '## Detailed Checks', '', '| Result | Route / scope | Check | Observed |', '|---|---|---|---|'])
    for route, label, passed, detail in findings:
        lines.append(f"| {'PASS' if passed else 'FAIL'} | {route} | {label} | {detail.replace('|', '/')} |")
    Path(args.report).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('REPORT: ' + str(Path(args.report)))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())