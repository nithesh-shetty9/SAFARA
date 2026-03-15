// ── SAFARA — Map Page JS ──

// Default map centre — Mangaluru (matches incident dataset)
const BENGALURU = [12.8698, 74.8430];

let map = null;
let routeLayers = [];
let crimeDots = [];
let pinMarkers = [];
let currentRoutes = [];
let selectedRouteIdx = 0;
let showCrime = true;

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcRouteScore(coords, crimes, threshold = 0.35) {
  let risk = 0;
  const sample = coords.filter((_, i) => i % 5 === 0);
  sample.forEach(pt => {
    crimes.forEach(c => {
      const d = haversineKm(pt, [c.lat, c.lng]);
      if (d < threshold) {
        const weight = c.severity === 'HIGH' ? 3 : c.severity === 'MEDIUM' ? 2 : 1;
        risk += weight * (1 - d / threshold);
      }
    });
  });
  return Math.round(Math.max(0, 10 - risk * 0.8) * 10) / 10;
}

function routeAppearance(score) {
  if (score >= 7.5) return { color: '#16a34a', label: 'Safest',    emoji: '🟢', bg: '#dcfce7', text: '#15803d' };
  if (score >= 5)   return { color: '#d97706', label: 'Moderate',  emoji: '🟠', bg: '#fef3c7', text: '#b45309' };
  return               { color: '#dc2626', label: 'High Risk', emoji: '🔴', bg: '#fee2e2', text: '#b91c1c' };
}

function initMap() {
  map = L.map('safara-map', { zoomControl: false }).setView(BENGALURU, 13);

  // Standard OSM tiles — full colour map matching original interface
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Try geolocation — blue circle marker matching original
  navigator.geolocation?.getCurrentPosition(p => {
    const ll = [p.coords.latitude, p.coords.longitude];
    map.setView(ll, 14);
    L.circleMarker(ll, {
      radius: 9, color: '#2851a3', fillColor: '#3b82f6',
      fillOpacity: 0.9, weight: 2
    }).addTo(map).bindPopup('<b>📍 You are here</b>').openPopup();
  });

  drawCrimeDots();
}

function getCrimes() {
  return DB.getIncidents()
    .filter(i => i.status === 'confirmed')
    .map(i => ({ lat: i.lat, lng: i.lng, severity: i.severity, type: i.type, location: i.location }));
}

function drawCrimeDots() {
  crimeDots.forEach(m => map.removeLayer(m));
  crimeDots = [];
  if (!showCrime) return;

  const crimes = getCrimes();
  crimes.forEach(c => {
    const r = c.severity === 'HIGH' ? 9 : c.severity === 'MEDIUM' ? 7 : 5;
    const op = c.severity === 'HIGH' ? .85 : c.severity === 'MEDIUM' ? .65 : .45;
    const m = L.circleMarker([c.lat, c.lng], {
      radius: r, color: '#dc2626', fillColor: '#ef4444',
      fillOpacity: op, weight: 1.5,
    }).addTo(map);
    m.bindPopup(`<b>🔴 ${c.type}</b><br/>${c.location}<br/><small>${c.severity} severity</small>`);
    crimeDots.push(m);
  });
}

function drawRoutes() {
  routeLayers.forEach(l => map.removeLayer(l));
  routeLayers = [];
  if (!currentRoutes.length) return;

  const order = [...currentRoutes.keys()].sort(i => i === selectedRouteIdx ? 1 : -1);
  order.forEach(i => {
    const r = currentRoutes[i];
    const isSel = i === selectedRouteIdx;
    const layer = L.geoJSON(r.geometry, {
      style: {
        color: r.color, weight: isSel ? 7 : 4,
        opacity: isSel ? .95 : .4,
        lineCap: 'round', lineJoin: 'round',
        dashArray: isSel ? null : '8 6',
      }
    }).addTo(map);
    layer.bindPopup(`<b>${r.emoji} ${r.label}</b> — Safety ${r.score}/10<br/>${r.dist} km · ${r.time} min`);
    routeLayers.push(layer);
  });
}

function renderRouteCards() {
  const section = document.getElementById('route-cards-section');
  if (!currentRoutes.length) { section.innerHTML = ''; return; }

  // Label format matching screenshot: "2 ROUTES COMPARED"
  section.innerHTML = `
    <div class="route-cards-label">${currentRoutes.length} ROUTE${currentRoutes.length > 1 ? 'S' : ''} COMPARED</div>
    ${currentRoutes.map((r, i) => `
      <div class="route-card${selectedRouteIdx === i ? ' selected' : ''}"
        style="border-color:${selectedRouteIdx === i ? r.color : 'var(--border)'};background:${selectedRouteIdx === i ? r.bg : 'var(--card)'}"
        onclick="selectRoute(${i})">
        <div class="route-card-header">
          <span class="route-card-label" style="color:${r.text}">
            ${r.emoji} Route ${i + 1} — ${r.label}
            ${i === 0 ? `<span class="route-best-badge" style="background:${r.color}">BEST</span>` : ''}
          </span>
          <span class="route-card-score" style="color:${r.text}">${r.score} / 10</span>
        </div>
        <div class="route-bar">
          <div class="route-bar-fill" style="width:${r.score * 10}%;background:${r.color}"></div>
        </div>
        <div class="route-meta">
          <span>📏 ${r.dist} km</span>
          <span>⏱ ${r.time} min</span>
          <span style="color:${r.text};font-weight:600">Safety ${r.score}/10</span>
        </div>
      </div>`).join('')}`;

  // Hide welcome card once routes appear
  document.getElementById('map-welcome').classList.add('hidden');
}

function selectRoute(idx) {
  selectedRouteIdx = idx;
  drawRoutes();
  renderRouteCards();
}

// ── Geocoding ────────────────────────────────────────────────────────────────
// Rules:
//   1. If query already contains a comma (e.g. "Connaught Place, Delhi") →
//      treat as fully-qualified; search as-is, no city suffix appended.
//   2. If query looks like plain coordinates "12.97,77.59" → parse directly.
//   3. Otherwise → search globally without forcing Bengaluru context so the
//      user can route anywhere in the world.

function looksLikeCoords(q) {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(q.trim());
}

async function geocode(q) {
  const trimmed = q.trim();

  // Direct lat,lng input
  if (looksLikeCoords(trimmed)) {
    const [lat, lng] = trimmed.split(',').map(Number);
    return [lat, lng];
  }

  // Build query — never force-append a city so global searches work correctly.
  // Nominatim's free-form search handles "MG Road, Bengaluru" and
  // "Times Square, New York" equally well when not polluted with extra context.
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1&addressdetails=1`;

  const r = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'SAFARA-App/1.0' }
  });
  const d = await r.json();

  if (!d?.[0]) return null;
  return [parseFloat(d[0].lat), parseFloat(d[0].lon)];
}

// ── Routing ──────────────────────────────────────────────────────────────────
// OSRM public demo server:
//   - /driving/  → works globally (roads worldwide)
//   - /foot/     → only has dense data for a few regions; silently snaps to
//                  the nearest node which caused the "always Bengaluru" bug.
// We use driving for accurate worldwide routing. Duration is converted to a
// walking estimate (÷ 5 km/h ≈ × 0.72) for the on-foot time shown in the card.

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

// ── Waypoint offset helper ────────────────────────────────────────────────────
// When OSRM only returns 1 route, we nudge a mid-point perpendicular to the
// direct line and re-query, giving a genuinely different road path.
function midpointOffset(sc, dc, offsetFraction = 0.18) {
  const midLat = (sc[0] + dc[0]) / 2;
  const midLng = (sc[1] + dc[1]) / 2;
  // Perpendicular direction (rotate bearing 90°)
  const dLat = dc[0] - sc[0];
  const dLng = dc[1] - sc[1];
  const len  = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
  return [
    midLat + (-dLng / len) * offsetFraction,
    midLng + ( dLat / len) * offsetFraction,
  ];
}

async function fetchOSRM(startCoord, destCoord) {
  // ── Attempt 1: direct with alternatives=true ────────────────────────────
  const directUrl = `${OSRM_BASE}/${startCoord[1]},${startCoord[0]};${destCoord[1]},${destCoord[0]}?overview=full&geometries=geojson&alternatives=true`;
  const res1  = await fetch(directUrl);
  const data1 = await res1.json();

  const routes = (data1.code === 'Ok' && data1.routes?.length) ? [...data1.routes] : [];

  // ── Attempt 2: offset waypoint route (always run, guarantees diversity) ──
  try {
    const wp = midpointOffset(startCoord, destCoord);
    const waypointUrl = `${OSRM_BASE}/${startCoord[1]},${startCoord[0]};${wp[1]},${wp[0]};${destCoord[1]},${destCoord[0]}?overview=full&geometries=geojson`;
    const res2  = await fetch(waypointUrl);
    const data2 = await res2.json();
    if (data2.code === 'Ok' && data2.routes?.length) {
      routes.push(data2.routes[0]);
    }
  } catch { /* ignore — we already have at least 1 from attempt 1 */ }

  // ── Attempt 3: second offset in opposite direction ────────────────────
  try {
    const wp2 = midpointOffset(startCoord, destCoord, -0.18);
    const url3 = `${OSRM_BASE}/${startCoord[1]},${startCoord[0]};${wp2[1]},${wp2[0]};${destCoord[1]},${destCoord[0]}?overview=full&geometries=geojson`;
    const res3  = await fetch(url3);
    const data3 = await res3.json();
    if (data3.code === 'Ok' && data3.routes?.length) {
      routes.push(data3.routes[0]);
    }
  } catch { /* ignore */ }

  if (!routes.length) return null;

  // De-duplicate: remove routes whose geometry is nearly identical
  // (same distance within 2%) to avoid showing duplicate cards.
  const unique = routes.filter((r, i) => {
    return !routes.slice(0, i).some(prev =>
      Math.abs(prev.distance - r.distance) / (prev.distance || 1) < 0.02
    );
  });

  return unique.length ? unique : routes.slice(0, 1);
}

async function findRoute() {
  const startVal = document.getElementById('rp-start').value.trim();
  const destVal  = document.getElementById('rp-dest').value.trim();
  if (!destVal) return;

  const btn = document.getElementById('rp-go');
  btn.disabled = true;
  btn.textContent = 'Calculating safe routes…';
  document.getElementById('map-loading').classList.add('visible');

  try {
    // ── Resolve start coordinate ──────────────────────────────────────────
    let sc;
    if (!startVal || startVal.toLowerCase() === 'my location') {
      sc = await new Promise(res => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(
          p  => res([p.coords.latitude, p.coords.longitude]),
          () => res(null),
          { timeout: 6000 }
        );
      });
      if (!sc) {
        Toast.show('Location unavailable', 'Enter a start address manually.', '⚠️');
        return;
      }
    } else {
      sc = await geocode(startVal);
      if (!sc) {
        Toast.show('Start not found', `"${startVal}" could not be located. Try adding a city name.`, '⚠️');
        return;
      }
    }

    // ── Resolve destination coordinate ────────────────────────────────────
    const dc = await geocode(destVal);
    if (!dc) {
      Toast.show('Destination not found', `"${destVal}" could not be located. Try adding a city name.`, '⚠️');
      return;
    }

    // ── Sanity check — warn if the two points are very far apart (>500 km) ─
    const straightLine = haversineKm(sc, dc);
    if (straightLine > 500) {
      Toast.show(
        'Very long route',
        `${Math.round(straightLine)} km apart — routing may be slow.`,
        '⚠️'
      );
    }

    // ── Fetch routes from OSRM ────────────────────────────────────────────
    const osrmRoutes = await fetchOSRM(sc, dc);
    if (!osrmRoutes) {
      Toast.show('No route found', 'OSRM could not find a road connection between these points.', '⚠️');
      return;
    }

    // ── Score each route against local crime data ─────────────────────────
    // Crime scoring only makes sense when the route is in/near Bengaluru.
    // For distant routes all scores will naturally be 10/10 (no crime dots nearby).
    const crimes = getCrimes();
    const scored = osrmRoutes.map(r => {
      const coords = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const score  = calcRouteScore(coords, crimes);
      const app    = routeAppearance(score);
      // Convert driving duration to a rough walking estimate (avg 5 km/h vs 50 km/h)
      const walkMins = Math.ceil((r.distance / 1000) / 5 * 60);
      return {
        score,
        dist: (r.distance / 1000).toFixed(1),
        time: walkMins,
        geometry: r.geometry,
        coords,
        ...app,
      };
    });
    scored.sort((a, b) => b.score - a.score);

    // ── Place start / destination pins ────────────────────────────────────
    pinMarkers.forEach(m => map.removeLayer(m));
    const mkA = L.divIcon({
      html: `<div style="background:#1b3a6b;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.35)">📍</div>`,
      className: '', iconAnchor: [14, 14]
    });
    const mkB = L.divIcon({
      html: `<div style="background:#16a34a;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.35)">🎯</div>`,
      className: '', iconAnchor: [14, 14]
    });
    pinMarkers = [
      L.marker(sc, { icon: mkA }).addTo(map).bindPopup(`<b>📍 Start</b><br/>${startVal || 'My Location'}`),
      L.marker(dc, { icon: mkB }).addTo(map).bindPopup(`<b>🎯 Destination</b><br/>${destVal}`),
    ];

    // ── Fit map to best route ─────────────────────────────────────────────
    map.fitBounds(L.geoJSON(scored[0].geometry).getBounds(), { padding: [80, 80] });

    currentRoutes   = scored;
    selectedRouteIdx = 0;
    drawRoutes();
    renderRouteCards();
    Toast.show(
      'Routes calculated',
      `${scored.length} route${scored.length > 1 ? 's' : ''} · ${scored[0].dist} km`,
      '🗺'
    );
  } catch (e) {
    console.error('findRoute error:', e);
    Toast.show('Error', 'Check your internet connection and try again.', '⚠️');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Compare Routes →';
    document.getElementById('map-loading').classList.remove('visible');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;

  // Render header
  document.getElementById('app-header').innerHTML = renderHeader(user);

  // Sidebar nav
  const nav = user.role === 'admin'
    ? [{ id: 'gov', icon: '🏛', label: 'Analytics' }, { id: 'incidents', icon: '📋', label: 'Incidents' }, { id: 'ngo', icon: '🛡', label: 'Emergency' }, { id: 'about', icon: 'ℹ️', label: 'About' }]
    : user.role === 'ngo'
    ? [{ id: 'incidents', icon: '📊', label: 'Incidents' }, { id: 'ngo', icon: '🛡', label: 'Emergency' }, { id: 'report', icon: '📋', label: 'Report' }, { id: 'about', icon: 'ℹ️', label: 'About' }]
    : [{ id: 'map', icon: '🗺', label: 'Navigate' }, { id: 'report', icon: '📋', label: 'Report' }, { id: 'ngo', icon: '🛡', label: 'Emergency' }, { id: 'about', icon: 'ℹ️', label: 'About' }];

  document.getElementById('sidebar').innerHTML = renderSidebar(nav, 'map', id => {
    const pages = { map: 'map.html', report: 'report.html', ngo: 'ngo.html', about: 'about.html', incidents: 'incidents.html', gov: 'gov.html' };
    if (pages[id]) window.location.href = pages[id];
  });

  // Crime toggle
  document.getElementById('crime-toggle').addEventListener('change', e => {
    showCrime = e.target.checked;
    drawCrimeDots();
  });

  // Route search
  document.getElementById('rp-go').addEventListener('click', findRoute);
  document.getElementById('rp-dest').addEventListener('keydown', e => { if (e.key === 'Enter') findRoute(); });

  // Init map
  initMap();
});
