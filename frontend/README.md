# SAFARA Frontend

React, Vite, and React Router client for the SAFARA user app and district command consoles.

## Run

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Run the Flask backend at `http://127.0.0.1:5000`. Set `VITE_API_BASE_URL` in `.env.local` only when the API is hosted elsewhere. Mapbox maps, place search, and route calculation require `VITE_MAPBOX_ACCESS_TOKEN`; use a public token restricted to the app's allowed origins. Do not use a secret-scope token in a Vite variable.

## Routes

- Public: `/login`, `/signup`
- `USER`: `/app`, `/app/explore`, `/app/reports`, `/app/report`, `/app/sos`, `/app/contacts`, `/app/profile`, `/ngo-register`
- `NGO_OFFICER` and `GOV_OFFICER`: `/officer`, `/officer/map`, `/officer/alerts`, `/officer/assignments`
- `DISTRICT_ADMIN` and `SUPER_ADMIN`: `/admin`, `/admin/incidents`, `/admin/officers`, `/admin/analytics`, `/admin/trust`, `/admin/alerts`, `/admin/system`

The backend JWT is authoritative. React guards provide navigation only; Flask enforces API permissions.

## Behavior and backend boundaries

- User maps use Mapbox GL JS; admin/officer district maps use Leaflet.
- User map markers come from the backend's confirmed-only public incident endpoint. Popups show category, severity, location, and report time, never reporter identity.
- Route alternatives use Mapbox Directions and are scored against confirmed incident proximity/severity. The indicator is based on incomplete reports and is not a personal-safety guarantee.
- Live GPS starts only after the user starts navigation. Stop Navigation, leaving the route, or unmounting the screen clears the geolocation watch.
- Incident reports collect a description and location; the backend performs classification. Category and incident time are not user-editable in this flow.
- SOS requires a three-second hold and records a location with the backend. It does not send SMS, notify personal contacts, or contact emergency services.
- Personal emergency contacts are stored in browser local storage per account on this device only. They are not synced to the backend or account.
- NGO officers receive their own assignment feed from `/ngo/dashboard`. The current backend does not provide a government-officer assignment-list endpoint.
- Analytics, alert history, trust data, system settings, and audit records are rendered from backend responses. Response-time analytics and a generated AI district-insight endpoint are not currently available.
- Live database data uses authenticated polling because the backend does not expose a push/WebSocket stream: SOS/alerts refresh every 5 seconds, incident queues and dashboards every 15–20 seconds, maps every 30 seconds, and analytics/system data every 30–60 seconds. Polling pauses in hidden tabs and refreshes when the tab becomes active.
- Gemini credentials remain server-side.

## Validation

Run `npm run build` from `frontend/`. The routed user, admin, and officer screens were browser-smoke-tested with mocked API responses; location-sensitive interactions were tested with a controlled browser geolocation stub. Real Mapbox rendering and directions require a valid restricted token.
