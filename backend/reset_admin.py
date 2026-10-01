from app import create_app
from app.db import execute
from werkzeug.security import generate_password_hash

email = "admin@safara.local"
new_password = "Admin@12345"

app = create_app()

with app.app_context():
    execute(
        """
        UPDATE users
        SET password_hash=%s,
            role='SUPER_ADMIN',
            status='active'
        WHERE email=%s
        """,
        (generate_password_hash(new_password), email)
    )

print("Admin password reset successfully.")
print("Email:", email)
print("Password:", new_password)