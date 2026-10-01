const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
const API_ROOT = 'https://api.mapbox.com'

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

export function routeExposure(route, incidents) {
  const coordinates = route.geometry.coordinates
  let exposure = 0
  for (const incident of incidents) {
    const lat = Number(incident.latitude)
    const lng = Number(incident.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    let closest = Infinity
    for (let index = 0; index < coordinates.length; index += 4) {
      const [routeLng, routeLat] = coordinates[index]
      const distance = Math.hypot((routeLng - lng) * 85, (routeLat - lat) * 111)
      closest = Math.min(closest, distance)
    }
    if (closest < 0.5) {
      const severity = String(incident.severity).toUpperCase()
      const weight = severity === 'CRITICAL' ? 4 : severity === 'HIGH' ? 3 : severity === 'MEDIUM' ? 2 : 1
      exposure += weight * (1 - closest / 0.5)
    }
  }
  return Math.max(0, Math.min(100, Math.round(100 - exposure * 8)))
}

export function distanceToRouteMeters(point, coordinates) {
  let closest = Infinity
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1]
    const end = coordinates[index]
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
  let travelled = 0
  let total = 0
  let closest = Infinity
  let closestProgress = 0
  const xScale = 111000 * Math.cos(point[1] * Math.PI / 180)
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1]
    const end = coordinates[index]
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