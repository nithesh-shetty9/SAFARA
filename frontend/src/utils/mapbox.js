const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
const API_ROOT = 'https://api.mapbox.com'
const DAY_MS = 24 * 60 * 60 * 1000

export const ROUTE_EXPOSURE_POLICY = Object.freeze({
  incidentRadiusMeters: 300,
  recencyWindowDays: 30,
  riskScoreMultiplier: 12,
  severityWeights: Object.freeze({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 })
})
export const SAME_PLACE_TOLERANCE_METERS = 25
export const ARRIVAL_TOLERANCE_METERS = 25

export function hasMapboxToken() {
  return Boolean(TOKEN)
}

export async function searchPlaces(query, signal) {
  if (!TOKEN) throw new Error('Add VITE_MAPBOX_ACCESS_TOKEN to frontend/.env.local to enable maps and place search.')
  const url = new URL(`${API_ROOT}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`)
  url.search = new URLSearchParams({
    access_token: TOKEN,
    autocomplete: 'true',
    country: 'in',
    language: 'en',
    limit: '6',
    proximity: '74.843,12.870',
    types: 'place,locality,neighborhood,address,poi'
  })
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Place search is unavailable right now.')
  const result = await response.json()
  return (result.features || []).map(place => ({
    id: place.id,
    name: place.text,
    label: place.place_name,
    coordinates: place.center
  }))
}

export async function getDrivingRoutes(source, destination, signal) {
  if (!TOKEN) throw new Error('Mapbox is not configured. Add a restricted public token to frontend/.env.local.')
  const coordinates = `${source[0]},${source[1]};${destination[0]},${destination[1]}`
  const url = new URL(`${API_ROOT}/directions/v5/mapbox/driving/${coordinates}`)
  url.search = new URLSearchParams({
    access_token: TOKEN,
    alternatives: 'true',
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    banner_instructions: 'true',
    language: 'en'
  })
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Route calculation is unavailable right now.')
  const result = await response.json()
  if (result.code !== 'Ok' || !result.routes?.length) throw new Error('No driving route was found for these places.')
  return result.routes
}

async function getWaypointRoute(source, waypoint, destination, signal) {
  const coordinates = `${source[0]},${source[1]};${waypoint[0]},${waypoint[1]};${destination[0]},${destination[1]}`
  const url = new URL(`${API_ROOT}/directions/v5/mapbox/driving/${coordinates}`)
  url.search = new URLSearchParams({
    access_token: TOKEN,
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    banner_instructions: 'true',
    language: 'en'
  })
  const response = await fetch(url, { signal })
  if (!response.ok) return []
  const result = await response.json()
  return result.code === 'Ok' ? result.routes || [] : []
}

export async function getAllRoutes(source, destination, signal) {
  if (isSamePlace(source, destination)) return []
  const routes = await getDrivingRoutes(source, destination, signal)
  const middleLng = (source[0] + destination[0]) / 2
  const middleLat = (source[1] + destination[1]) / 2
  const deltaLng = destination[0] - source[0]
  const deltaLat = destination[1] - source[1]
  const length = Math.hypot(deltaLng, deltaLat) || 1
  const offset = Math.min(0.025, Math.max(0.006, length * 0.12))
  const sideWaypoints = [
    [middleLng - (deltaLat / length) * offset, middleLat + (deltaLng / length) * offset],
    [middleLng + (deltaLat / length) * offset, middleLat - (deltaLng / length) * offset]
  ]
  const detours = await Promise.all(sideWaypoints.map(waypoint => getWaypointRoute(source, waypoint, destination, signal)))
  const unique = []
  for (const route of [...routes, ...detours.flat()]) {
    const coordinates = route.geometry?.coordinates || []
    if (coordinates.length < 2) continue
    const signature = `${coordinates[0].join(',')}:${coordinates[Math.floor(coordinates.length / 2)].join(',')}:${coordinates.at(-1).join(',')}`
    if (unique.some(item => item.signature === signature || Math.abs(item.route.distance - route.distance) < 100 && Math.abs(item.route.duration - route.duration) < 30)) continue
    unique.push({ route, signature })
  }
  return unique.map(item => item.route).sort((a, b) => a.duration - b.duration)
}

function validCoordinatePair(longitude, latitude) {
  return Number.isFinite(longitude) && Number.isFinite(latitude) &&
    longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90
}

function incidentCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || typeof value === 'boolean' || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null
}

function recencyWeight(createdAt, now, recencyWindowDays) {
  if (!createdAt) return 1
  const timestamp = Date.parse(createdAt)
  if (!Number.isFinite(timestamp)) return 1
  const age = Math.max(0, now - timestamp)
  const windowMs = recencyWindowDays * DAY_MS
  return Math.max(0, Math.min(1, 1 - age / windowMs))
}

export function routeSafety(route, incidents, now = Date.now(), overrides = {}) {
  const policy = {
    ...ROUTE_EXPOSURE_POLICY,
    ...overrides,
    severityWeights: { ...ROUTE_EXPOSURE_POLICY.severityWeights, ...overrides.severityWeights }
  }
  const coordinates = route?.geometry?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return { score: 100, incidentCount: 0 }
  let risk = 0
  let incidentCount = 0
  for (const incident of incidents) {
    if (incident.status && String(incident.status).toUpperCase() !== 'CONFIRMED') continue
    const longitude = incidentCoordinate(incident.longitude, -180, 180)
    const latitude = incidentCoordinate(incident.latitude, -90, 90)
    if (longitude === null || latitude === null) continue
    const distance = distanceToRouteMeters([longitude, latitude], coordinates)
    if (!Number.isFinite(distance) || distance > policy.incidentRadiusMeters) continue
    incidentCount += 1
    const severity = String(incident.severity || '').toUpperCase()
    const severityWeight = policy.severityWeights[severity] || policy.severityWeights.LOW
    const distanceWeight = 1 - distance / policy.incidentRadiusMeters
    risk += severityWeight * distanceWeight * recencyWeight(incident.created_at, now, policy.recencyWindowDays)
  }
  const score = Number.isFinite(risk)
    ? Math.max(0, Math.min(100, Math.round(100 - risk * policy.riskScoreMultiplier)))
    : 0
  return { score, incidentCount }
}

export function routeExposure(route, incidents, now = Date.now(), policy = ROUTE_EXPOSURE_POLICY) {
  return routeSafety(route, incidents, now, policy).score
}

export function coordinatesDistanceMeters(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) ||
      !validCoordinatePair(first[0], first[1]) || !validCoordinatePair(second[0], second[1])) return Infinity
  const toRadians = degrees => degrees * Math.PI / 180
  const latitudeDelta = toRadians(second[1] - first[1])
  const longitudeDelta = toRadians(second[0] - first[0])
  const firstLatitude = toRadians(first[1])
  const secondLatitude = toRadians(second[1])
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2
  const boundedHaversine = Math.max(0, Math.min(1, haversine))
  return 6371000 * 2 * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine))
}

export function isSamePlace(first, second) {
  return coordinatesDistanceMeters(first, second) <= SAME_PLACE_TOLERANCE_METERS
}

export function hasArrivedAtDestination(point, destination, remainingMeters) {
  return Number.isFinite(remainingMeters) && remainingMeters <= ARRIVAL_TOLERANCE_METERS &&
    coordinatesDistanceMeters(point, destination) <= ARRIVAL_TOLERANCE_METERS
}

export function distanceToRouteMeters(point, coordinates) {
  if (!Array.isArray(point) || !validCoordinatePair(point[0], point[1]) || !Array.isArray(coordinates)) return Infinity
  let closest = Infinity
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1]
    const end = coordinates[index]
    if (!Array.isArray(start) || !Array.isArray(end) ||
      !validCoordinatePair(start[0], start[1]) || !validCoordinatePair(end[0], end[1])) continue
    const xScale = 111000 * Math.cos(point[1] * Math.PI / 180)
    const startX = (start[0] - point[0]) * xScale
    const startY = (start[1] - point[1]) * 111000
    const endX = (end[0] - point[0]) * xScale
    const endY = (end[1] - point[1]) * 111000
    const dx = endX - startX
    const dy = endY - startY
    const fraction = Math.max(0, Math.min(1, -(startX * dx + startY * dy) / (dx * dx + dy * dy || 1)))
    closest = Math.min(closest, Math.hypot(startX + fraction * dx, startY + fraction * dy))
  }
  return closest
}

export function remainingRouteMeters(point, coordinates) {
  if (!Array.isArray(point) || !validCoordinatePair(point[0], point[1]) || !Array.isArray(coordinates)) return 0
  let travelled = 0
  let total = 0
  let closest = Infinity
  let closestProgress = 0
  const xScale = 111000 * Math.cos(point[1] * Math.PI / 180)
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1]
    const end = coordinates[index]
    if (!Array.isArray(start) || !Array.isArray(end) ||
      !validCoordinatePair(start[0], start[1]) || !validCoordinatePair(end[0], end[1])) continue
    const startX = (start[0] - point[0]) * xScale
    const startY = (start[1] - point[1]) * 111000
    const endX = (end[0] - point[0]) * xScale
    const endY = (end[1] - point[1]) * 111000
    const dx = endX - startX
    const dy = endY - startY
    const segmentLength = Math.hypot(dx, dy)
    const fraction = Math.max(0, Math.min(1, -(startX * dx + startY * dy) / (segmentLength * segmentLength || 1)))
    const distance = Math.hypot(startX + fraction * dx, startY + fraction * dy)
    if (distance < closest) {
      closest = distance
      closestProgress = total + segmentLength * fraction
    }
    total += segmentLength
  }
  travelled = closestProgress
  return Math.max(0, total - travelled)
}