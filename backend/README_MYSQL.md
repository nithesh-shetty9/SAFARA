# SAFARA Backend — MySQL version

Replace the existing `safara/backend` folder with these files.

## 1. Install dependencies

```bash
cd safara/backend
python -m pip install -r requirements.txt
```

## 2. Configure environment variables

Create a file named `.env` in `safara/backend` (or set the variables in your terminal):

```text
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=safara
JWT_SECRET=change-this-to-a-long-random-string
```

The code reads environment variables directly. If you want Flask to load `.env` automatically, install `python-dotenv` and add `from dotenv import load_dotenv; load_dotenv()` at the top of `app.py` before importing the routes.

## 3. Important: current demo users

The existing demo rows may contain plain text passwords (`user123`, `ngo123`, `admin123`). The new login endpoint accepts those demo values once and immediately upgrades each password to a Werkzeug hash.

New registrations are hashed immediately.

## 4. Test

Run:

```bash
python app.py
```

Then open:

`http://localhost:5000/api/health`

Expected shape:

```json
{"status":"ok","database":"mysql",...}
```

## API

- POST `/api/auth/login`
- POST `/api/auth/signup`
- POST `/api/auth/ngo-register`
- GET `/api/contacts`
- GET `/api/incidents`
- POST `/api/incidents`
- PATCH `/api/incidents/<id>`
- POST `/api/classify`
- GET `/api/stats`
- GET `/api/health`
