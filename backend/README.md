# SAFARA Backend

Flask + MySQL REST API for SAFARA. The backend uses **Gemini only** for incident classification, with a deterministic rule fallback if Gemini is unavailable.

## Stack
- Python / Flask
- MySQL / PyMySQL
- JWT authentication
- Gemini API via `google-genai`
- CORS for the configured frontend origins

## Setup

1. Create the database and schema:

```sql
SOURCE sql/schema.sql;
SOURCE sql/migration_locations.sql;
```

2. Create `.env` from `.env.example` and fill in your own values:

```env
PORT=5000
JWT_SECRET=your_random_secret_at_least_32_chars
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=safara
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JWT_EXPIRES_MINUTES=60
```

**Never commit `.env`.** The Gemini key belongs only in the Flask backend.

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Create the first administrator:

```bash
set ADMIN_EMAIL=admin@safara.local
set ADMIN_PASSWORD=ChangeThisImmediately!
python scripts/create_admin.py
```

5. Start the API:

```bash
python app.py
```

Base URL:

`http://127.0.0.1:5000/api/v1`

## API groups

- `/auth` — registration, login, current user, NGO applications
- `/incidents` — create, classify, list, detail, review, classification correction, assignment
- `/sos` — SOS creation and officer handling
- `/contacts` — emergency contacts
- `/ngo` — NGO dashboard/profile
- `/admin` — administration, alerts, protocols, audit logs
- `/analytics` — dashboard, severity, types, trend, hotspots
- `/system` — health details and controlled system settings
- `/locations` — save and retrieve the signed-in user's location; officer live-location feed
- `/health` — public API/database health

### Location migration

Before applying `sql/migration_locations.sql`, verify the target is an approved disposable or non-production database and that `users.id` is `BIGINT UNSIGNED`. The location tables reference `users(id)` and cascade when a user is deleted. Do not apply this migration to a production or unverified database.

From a MySQL client connected to the approved database:

```sql
SOURCE sql/migration_locations.sql;
```

The migration creates `user_locations` (one current row per user) and `location_trail` (navigation breadcrumbs). Both are InnoDB tables with user foreign keys; no migration was applied during the current SAFARA QA run because the connected `safara` database contains existing application data and is not confirmed disposable.

### SOS access policy

- Regular users can list only their own SOS records and can cancel only their own active SOS.
- NGO and government officers can list only active/acknowledged SOS records and may acknowledge or resolve them. Their response projection excludes user IDs and message/internal handling fields.
- District and super administrators can list all SOS statuses and use the admin status workflow; the response projection still excludes unnecessary identity/contact fields.
- SOS records are persisted only. Creating an SOS does not notify contacts or emergency services.

## Security behavior

- JWTs include `sub`, `iat`, and `exp`; the user is reloaded from MySQL on every authenticated request.
- Passwords are hashed with Werkzeug.
- SQL uses parameterized queries.
- Incident coordinates are range-checked.
- Incident descriptions are capped at 5000 characters before classification.
- Incident reports are rate-limited using the `max_reports_per_user_hour` system setting.
- Login and registration have a basic process-local rate limit. For multi-instance production, use shared Redis/WAF rate limiting.
- Admin multi-step operations (NGO approval and emergency protocols) are transactional, including their audit entry.
- Incident reassignment is transactional and cancels the previous active assignment.
- Admins can correct an incident classification through `PATCH /incidents/:id/classification`; this records `ADMIN_CORRECTION`.
- Raw server/database exception details are not returned to clients.

## AI classification

The classification service restricts output to the SAFARA taxonomy:

`stalking`, `harassment`, `assault`, `theft`, `accident`, `poor_lighting`, `unsafe_area`, `suspicious_activity`, `safe_zone`, `other`

Severity:

`low`, `medium`, `high`, `critical`

The API stores both the AI-derived values and the classification source (`AI`, `RULE`, or `ADMIN_CORRECTION`).

## Important limitation

This package is source-complete and statically verified, but a real MySQL/Gemini integration run must be performed on the machine where MySQL and the user's Gemini key are available. This environment does not have access to that database or network, so no claim of a live end-to-end test is made here.
