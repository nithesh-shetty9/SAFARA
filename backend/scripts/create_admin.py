import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import create_app
from app.db import execute, query
from app.security import hash_password

app = create_app()


def main():
	email = os.getenv('ADMIN_EMAIL', 'admin@safara.local').strip().lower()
	password = os.getenv('ADMIN_PASSWORD', 'ChangeMe123!')
	name = os.getenv('ADMIN_NAME', 'SAFARA Admin')

	with app.app_context():
		existing = query('SELECT id FROM users WHERE email=%s', (email,), True)
		if existing:
			print(f'Admin exists: {email}')
			return

		admin_id, _ = execute(
			"INSERT INTO users(name,email,password_hash,role,status) VALUES(%s,%s,%s,'SUPER_ADMIN','active')",
			(name, email, hash_password(password)),
		)
		print(f'Created admin id {admin_id} email {email}')


if __name__ == '__main__':
	main()
