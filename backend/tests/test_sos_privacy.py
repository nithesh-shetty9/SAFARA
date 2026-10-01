import unittest
from unittest.mock import patch

from app import create_app
from app.security import token


class SosPrivacyTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        self.user = {
            'id': 11,
            'name': 'Synthetic SOS User',
            'email': 'sos-user@example.invalid',
            'role': 'USER',
            'status': 'active',
        }

    def headers(self):
        return {'Authorization': f"Bearer {token({'id': self.user['id'], 'role': self.user['role']})}"}

    def test_user_list_is_limited_to_own_id_and_minimal_projection(self):
        row = {'id': 31, 'latitude': 12.9, 'longitude': 74.85, 'address': None, 'status': 'ACTIVE', 'created_at': 'now'}
        with patch('app.security.query', return_value=self.user), patch('app.routes.sos.query', return_value=[row]) as query:
            response = self.client.get('/api/v1/sos', headers=self.headers())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['items'], [row])
        sql, params = query.call_args.args[:2]
        self.assertIn('WHERE user_id=%s', sql)
        self.assertEqual(params, (11,))
        self.assertNotIn('message', sql.lower())
        self.assertNotIn('user_id,', sql.lower())

    def test_officer_list_is_active_operational_scope_without_identity_fields(self):
        officer_user = {**self.user, 'role': 'NGO_OFFICER'}
        row = {'id': 31, 'latitude': 12.9, 'longitude': 74.85, 'address': None, 'status': 'ACTIVE', 'created_at': 'now'}
        with patch('app.security.query', return_value=officer_user), patch('app.routes.sos.query', return_value=[row]) as query:
            response = self.client.get('/api/v1/sos', headers=self.headers())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['items'], [row])
        sql = query.call_args.args[0]
        self.assertIn("status IN ('ACTIVE','ACKNOWLEDGED')", sql)
        self.assertNotIn('user_id', sql.lower())
        self.assertNotIn('message', sql.lower())
        self.assertNotIn('email', sql.lower())
        self.assertNotIn('phone', sql.lower())
        self.assertNotIn('password', sql.lower())

    def test_admin_list_uses_minimal_projection_without_status_filter(self):
        admin_user = {**self.user, 'role': 'DISTRICT_ADMIN'}
        row = {'id': 31, 'latitude': 12.9, 'longitude': 74.85, 'address': None, 'status': 'CANCELLED', 'created_at': 'now'}
        with patch('app.security.query', return_value=admin_user), patch('app.routes.sos.query', return_value=[row]) as query:
            response = self.client.get('/api/v1/sos', headers=self.headers())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['items'], [row])
        sql = query.call_args.args[0]
        self.assertIn('ORDER BY created_at DESC LIMIT 200', sql)
        self.assertNotIn('WHERE status', sql)
        self.assertNotIn('message', sql.lower())

    def test_user_cannot_cancel_another_users_sos_by_id(self):
        foreign_row = {'id': 31, 'user_id': 22, 'status': 'ACTIVE'}
        with patch('app.security.query', return_value=self.user), \
             patch('app.routes.sos.query', return_value=foreign_row), \
             patch('app.routes.sos.execute') as execute, \
             patch('app.routes.sos.audit') as audit:
            response = self.client.patch('/api/v1/sos/31', headers=self.headers(), json={'status': 'CANCELLED'})

        self.assertEqual(response.status_code, 403)
        execute.assert_not_called()
        audit.assert_not_called()

    def test_officer_cannot_cancel_foreign_active_sos(self):
        officer_user = {**self.user, 'role': 'GOV_OFFICER'}
        foreign_row = {'id': 31, 'user_id': 22, 'status': 'ACTIVE'}
        with patch('app.security.query', return_value=officer_user), \
             patch('app.routes.sos.query', return_value=foreign_row), \
             patch('app.routes.sos.execute') as execute, \
             patch('app.routes.sos.audit') as audit:
            response = self.client.patch('/api/v1/sos/31', headers=self.headers(), json={'status': 'CANCELLED'})

        self.assertEqual(response.status_code, 403)
        execute.assert_not_called()
        audit.assert_not_called()

    def test_officer_can_acknowledge_an_active_operational_record(self):
        officer_user = {**self.user, 'role': 'NGO_OFFICER'}
        active_row = {'id': 31, 'user_id': 22, 'status': 'ACTIVE'}
        with patch('app.security.query', return_value=officer_user), \
             patch('app.routes.sos.query', return_value=active_row), \
             patch('app.routes.sos.execute') as execute, \
             patch('app.routes.sos.audit') as audit:
            response = self.client.patch('/api/v1/sos/31', headers=self.headers(), json={'status': 'ACKNOWLEDGED'})

        self.assertEqual(response.status_code, 200)
        execute.assert_called_once()
        audit.assert_called_once()

    def test_officer_cannot_change_finished_sos(self):
        officer_user = {**self.user, 'role': 'NGO_OFFICER'}
        finished_row = {'id': 31, 'user_id': 22, 'status': 'CANCELLED'}
        with patch('app.security.query', return_value=officer_user), \
             patch('app.routes.sos.query', return_value=finished_row), \
             patch('app.routes.sos.execute') as execute:
            response = self.client.patch('/api/v1/sos/31', headers=self.headers(), json={'status': 'ACKNOWLEDGED'})

        self.assertEqual(response.status_code, 409)
        execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
