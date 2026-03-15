click here to see live https://sssafara.netlify.app/
# SAFARA — Navigate Smart. Travel Safe.

Women's safety navigation app with community incident reporting and AI severity classification.

## Project Structure

```
safara/
├── frontend/
│   ├── css/
│   │   ├── base.css       # Shared variables, layout, header, sidebar, toast, modal
│   │   ├── auth.css       # Login / signup / NGO register styles
│   │   ├── map.css        # Map page + polished welcome card + route panel
│   │   └── pages.css      # Report, Emergency, Incidents, About, Gov dashboard
│   ├── js/
│   │   ├── utils.js       # DB, Session, LLM classify, Toast, SOS modal, header/sidebar renderers
│   │   └── map.js         # Leaflet map logic, routing, safety scoring
│   └── pages/
│       ├── login.html
│       ├── signup.html
│       ├── ngo-register.html
│       ├── map.html       ← Main navigate page (polished initial state)
│       ├── report.html
│       ├── ngo.html       ← Emergency contacts
│       ├── incidents.html
│       ├── gov.html       ← Admin analytics dashboard
│       └── about.html
└── backend/
    ├── app.py             # Flask REST API
    └── requirements.txt
```

## Frontend — Quick Start

Open `frontend/pages/login.html` directly in a browser — no server needed.
All state is managed via `localStorage`.

Demo credentials:
- `user@safara.in` / `user123`   → Commuter view
- `ngo@safara.in` / `ngo123`     → NGO/verifier view
- `admin@safara.in` / `admin123` → Government analytics dashboard

## Backend — Quick Start

```bash
cd backend
pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-ant-... python app.py
```

Server runs on `http://localhost:5000`

## Key Improvements (Map Page)

- **Polished initial state**: Welcome card with tips shown on load (glassmorphism style)
- **Cleaner tile layer**: CartoDB Light tiles instead of raw OSM for a refined look
- **Loading overlay**: Animated pill shown during route calculation
- **Animated user dot**: Pulsing blue circle instead of generic marker
- **Route panel**: Scrollable, with visual connector between start/end dots
- **Welcome card hides** automatically once routes are found

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/signup` | Register commuter |
| POST | `/api/auth/ngo-register` | Register NGO (pending approval) |
| GET | `/api/incidents` | List incidents (auth required) |
| POST | `/api/incidents` | Submit new incident |
| PATCH | `/api/incidents/<id>` | Update status (NGO/admin) |
| POST | `/api/classify` | AI severity via Claude |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/health` | Health check |

### Auth Header
```
Authorization: Bearer <user_id>:<role>
```
Token is returned on login.

## AI Integration

SAFARA uses **Claude claude-sonnet-4-20250514** to classify incident severity (LOW/MEDIUM/HIGH), detect harassment signals, and generate calm route advice.

- Frontend: add your API key in the **About** page → it's saved to `localStorage`
- Backend: set `ANTHROPIC_API_KEY` environment variable
- Without a key: keyword-based fallback classification is used automatically
