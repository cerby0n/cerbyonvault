#!/usr/bin/env python3

import secrets
import base64

def generate_key_encryption_secret():
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()

def generate_django_secret_key():
    chars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)'
    return ''.join(secrets.choice(chars) for _ in range(50))

# Generate secrets
key_encryption_secret = generate_key_encryption_secret()
django_secret_key = generate_django_secret_key()

# Default values
env_content = f"""DB_NAME=cerbyonvault
DB_USER=cerbyonvault
DB_PASSWORD="password"
DB_HOST=db
DB_PORT=5432

DOMAIN=localhost

DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost
DJANGO_CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:5173
KEY_ENCRYPTION_SECRET="{key_encryption_secret}"

DJANGO_SECRET_KEY='{django_secret_key}'

DJANGO_SUPERUSER_USERNAME="admin"
DJANGO_SUPERUSER_EMAIL="admin@cerbyon.local"
DJANGO_SUPERUSER_PASSWORD="password"
"""

# Write to .env file
with open(".env", "w") as f:
    f.write(env_content)

print("✅ .env file generated successfully with default values.")
print("📝 You can now edit the .env file to adjust values if needed.")
