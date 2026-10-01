import unittest
from contextlib import contextmanager
from unittest.mock import patch

from app import create_app
from app.security import token


class RecordingCursor:
    def __init__(self, statements):
        self.statements = statements

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, sql, params=()):
        self.statements.append((sql, params))


class RecordingDatabase:
    def __init__(self):
        self.statements = []

    def cursor(self):
        return RecordingCursor(self.statements)


class LocationRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        self.db = RecordingDatabase()
        self.user = {
            'id': 11,
            'name': 'Synthetic Location User',
            'email': 'location-user@example.invalid',
            'role': 'USER',
            'status': 'active',
        }

    def headers(self):
        return {'Authorization': f"Bearer {token({'id': self.user['id'], 'role': self.user['role']})}"}

    def atomic(self):
        @contextmanager
        def transaction():
            yield self.db
        return transaction()

    def test_put_uses_authenticated_user_and_adds_trail_only_when_navigating(self):
        with patch('app.security.query', return_value=self.user), patch('app.routes.locations.atomic', self.atomic):
            response = self.client.put('/api/v1/locations/current', headers=self.headers(), json={
                'user_id': 999,
                'latitude': 12.9,
                'longitude': 74.85,
                'accuracy': 12,
                'heading': 90,
                'speed': 2.5,
                'navigating': True,
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.db.statements), 2)
        self.assertIn('ON DUPLICATE KEY UPDATE', self.db.statements[0][0])
        self.assertEqual(self.db.statements[0][1][0], 11)
        self.assertEqual(self.db.statements[1][1][0], 11)
        self.assertEqual(self.db.statements[0][1][-1], True)
        self.assertIn('INSERT INTO location_trail', self.db.statements[1][0])

    def test_put_false_navigation_updates_current_without_trail(self):
        with patch('app.security.query', return_value=self.user), patch('app.routes.locations.atomic', self.atomic):
            response = self.client.put('/api/v1/locations/current', headers=self.headers(), json={
                'latitude': 12.9,
                'longitude': 74.85,
                'navigating': False,
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.db.statements), 1)
        self.assertEqual(self.db.statements[0][1][0], 11)
        self.assertFalse(self.db.statements[0][1][-1])

    def test_invalid_coordinates_do_not_open_transaction(self):
        invalid_payloads = [
            {'latitude': 'bad', 'longitude': 74.85},
            {'latitude': 91, 'longitude': 74.85},
            {'latitude': 12.9, 'longitude': float('inf')},
            {'latitude': True, 'longitude': 74.85},
        ]
        with patch('app.security.query', return_value=self.user), patch('app.routes.locations.atomic') as atomic:
            for payload in invalid_payloads:
                response = self.client.put('/api/v1/locations/current', headers=self.headers(), json=payload)
                self.assertEqual(response.status_code, 400)
            atomic.assert_not_called()

    def test_current_location_ignores_user_id_query_override(self):
        location = {'latitude': 12.9, 'longitude': 74.85, 'navigating': False}
        with patch('app.security.query', return_value=self.user), patch('app.routes.locations.query', return_value=location) as query:
            response = self.client.get('/api/v1/locations/current?user_id=999', headers=self.headers())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['location'], location)
        self.assertEqual(query.call_args.args[1], (11,))

    def test_user_is_denied_live_feed(self):
        with patch('app.security.query', return_value=self.user), patch('app.routes.locations.query') as query:
            response = self.client.get('/api/v1/locations/live', headers=self.headers())

        self.assertEqual(response.status_code, 403)
        query.assert_not_called()

    def test_live_feed_filters_active_recent_navigation_and_returns_minimal_fields(self):
        officer_user = {**self.user, 'role': 'NGO_OFFICER'}
        item = {'user_id': 22, 'latitude': 12.9, 'longitude': 74.85, 'accuracy': 9, 'heading': 45, 'speed': 1, 'updated_at': 'now'}
        with patch('app.security.query', return_value=officer_user), patch('app.routes.locations.query', return_value=[item]) as query:
            response = self.client.get('/api/v1/locations/live', headers=self.headers())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['items'], [item])
        sql = query.call_args.args[0]
        self.assertIn('l.navigating=TRUE', sql)
        self.assertIn('NOW()-INTERVAL 10 MINUTE', sql)
        self.assertIn("u.status='active'", sql)
        self.assertNotIn('u.name', sql.lower())
        self.assertNotIn('email', sql.lower())
        self.assertNotIn('password', sql.lower())


if __name__ == '__main__':
    unittest.main()
