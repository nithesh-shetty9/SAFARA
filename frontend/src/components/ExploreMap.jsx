import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { ArrowLeft, ArrowUpRight, LocateFixed, MapPin, Navigation, Search, Shield, X } from 'lucide-react'
import { API } from '../api/client'
import { coordinatesDistanceMeters, distanceToRouteMeters, getAllRoutes, hasArrivedAtDestination, hasMapboxToken, isSamePlace, remainingRouteMeters, routeSafety, searchPlaces } from '../utils/mapbox'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const START = [74.843, 12.870]
const formatDistance = meters => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
const formatDuration = seconds => `${Math.max(1, Math.round(seconds / 60))} min`
const safetyColor = score => score >= 80 ? '#24834a' : score >= 55 ? '#bd791d' : '#c53a36'
const safetyLabel = score => score >= 80 ? 'Lower risk' : score >= 55 ? 'Moderate risk' : 'Higher risk'

function PlaceSearch({ label, value, onChange, onSelect, onCurrentLocation, current = false }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const abort = useRef(null)

  useEffect(() => {
    if (!open || value.trim().length < 2) {
      setSuggestions([])
      return undefined
    }
    const controller = new AbortController()
    abort.current?.abort()
    abort.current = controller
    const timer = window.setTimeout(() => {
      searchPlaces(value.trim(), controller.signal)
        .then(places => { setSuggestions(places); setError('') })
        .catch(searchError => {
          if (searchError.name !== 'AbortError') setError(searchError.message)
        })
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [value, open])

  return (
    <div className="place-search">
      <label>{label}</label>
      <div className="place-search-field">
        <Search size={17} aria-hidden="true" />
        <input
          value={value}
          onChange={event => { onChange(event.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}
          placeholder={`Search ${label.toLowerCase()}`}
          autoComplete="off"
        />
        {value && <button className="bare-icon" type="button" aria-label={`Clear ${label}`} onClick={() => { onChange(''); setOpen(true) }}><X size={15} /></button>}
      </div>
      {current && <button className="location-pick" type="button" onClick={onCurrentLocation}><LocateFixed size={16} /> Use my current location</button>}
      {open && (suggestions.length > 0 || error) && <div className="place-suggestions" role="listbox">
        {error && <div className="place-search-error">{error}</div>}
        {suggestions.map(place => <button type="button" role="option" key={place.id} onClick={() => { onSelect(place); setOpen(false); setSuggestions([]) }}>
          <MapPin size={16} /><span><strong>{place.name}</strong><small>{place.label}</small></span>
        </button>)}
      </div>}
    </div>
  )
}

export default function ExploreMap() {
  const mapElement = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const routeMarkersRef = useRef([])
  const gpsMarkerRef = useRef(null)
  const locationMarkerRef = useRef(null)
  const watchRef = useRef(null)
  const navigationActiveRef = useRef(false)
  const locationSaveQueueRef = useRef(Promise.resolve())
  const reroutingRef = useRef(false)
  const destinationRef = useRef(null)
  const sourceRef = useRef(null)
  const lastLocationSaveRef = useRef(0)
  const latestCoordinatesRef = useRef(null)
  const latestPositionRef = useRef(null)
  const selectedRouteRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [incidents, setIncidents] = useState([])
  const [source, setSource] = useState(null)
  const [destination, setDestination] = useState(null)
  const [routes, setRoutes] = useState([])
  const [selected, setSelected] = useState(0)
  const [routeMode, setRouteMode] = useState('fastest')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [navigation, setNavigation] = useState(false)
  const [liveLocation, setLiveLocation] = useState(null)
  const [offRoute, setOffRoute] = useState(false)

  async function loadIncidents() {
    try { setIncidents(await API.publicIncidents({ limit: 100 })); setMessage('') }
    catch (error) { setMessage(error.message) }
  }
  useEffect(() => { loadIncidents() }, [])
  useAutoRefresh(loadIncidents, 30000)

  useEffect(() => {
    if (!mapElement.current || !hasMapboxToken()) return undefined
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
    const map = new mapboxgl.Map({
      container: mapElement.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: START,
      zoom: 12,
      attributionControl: true
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
    mapRef.current = map
    map.on('load', () => setMapReady(true))
    map.on('error', event => setMessage(event.error?.message || 'Map tiles could not be loaded.'))
    return () => {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current)
      markersRef.current.forEach(marker => marker.remove())
      routeMarkersRef.current.forEach(marker => marker.remove())
      gpsMarkerRef.current?.remove()
      locationMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = incidents.flatMap(incident => {
      const coordinates = [Number(incident.longitude), Number(incident.latitude)]
      if (!coordinates.every(Number.isFinite)) return []
      const dot = document.createElement('button')
      dot.type = 'button'
      dot.className = `incident-map-dot severity-${String(incident.severity || 'low').toLowerCase()}`
      dot.setAttribute('aria-label', `${incident.category || 'Incident'}, ${String(incident.severity || 'unknown').toLowerCase()} severity`)
      const popupContent = document.createElement('div')
      popupContent.className = 'incident-map-popup'
      const title = document.createElement('strong')
      title.textContent = String(incident.category || 'Incident').replaceAll('_', ' ')
      const severity = document.createElement('span')
      severity.textContent = `${String(incident.severity || 'unknown').toUpperCase()} severity`
      const place = document.createElement('span')
      place.textContent = incident.address || 'Mangaluru district'
      popupContent.append(title, severity, place)
      const popup = new mapboxgl.Popup({ offset: 14, closeButton: true }).setDOMContent(popupContent)
      return [new mapboxgl.Marker({ element: dot }).setLngLat(coordinates).setPopup(popup).addTo(map)]
    })
    return () => markersRef.current.forEach(marker => marker.remove())
  }, [incidents, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return undefined
    routeMarkersRef.current.forEach(marker => marker.remove())
    routeMarkersRef.current = [
      source?.coordinates && new mapboxgl.Marker({ color: '#2870bd' }).setLngLat(source.coordinates).setPopup(new mapboxgl.Popup().setText(source.name)).addTo(map),
      destination?.coordinates && new mapboxgl.Marker({ color: '#2a8372' }).setLngLat(destination.coordinates).setPopup(new mapboxgl.Popup().setText(destination.name)).addTo(map)
    ].filter(Boolean)
    return () => routeMarkersRef.current.forEach(marker => marker.remove())
  }, [source, destination, mapReady])

  const scoredRoutes = useMemo(() => routes.map(route => ({ ...route, ...routeSafety(route, incidents) })), [routes, incidents])
  const rankedRoutes = useMemo(() => routeMode === 'safest'
    ? [...scoredRoutes].sort((a, b) => b.score - a.score || a.duration - b.duration)
    : [...scoredRoutes].sort((a, b) => a.duration - b.duration).slice(0, 1), [scoredRoutes, routeMode])
  const selectedRoute = rankedRoutes[selected]
  selectedRouteRef.current = selectedRoute

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !map.isStyleLoaded()) return
    for (let index = 0; index < 8; index += 1) {
      const layerId = `safara-route-${index}`
      const sourceId = `${layerId}-source`
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
    rankedRoutes.forEach((route, index) => {
      const sourceId = `safara-route-${index}-source`
      const layerId = `safara-route-${index}`
      map.addSource(sourceId, { type: 'geojson', data: route.geometry })
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': routeMode === 'safest' ? safetyColor(route.score) : index === selected ? '#157a70' : '#6f8790',
          'line-width': index === selected ? 6 : 4,
          'line-opacity': index === selected ? 0.95 : 0.48,
          'line-dasharray': index === selected ? [1] : [2, 2]
        }
      })
    })
    const points = rankedRoutes[selected]?.geometry?.coordinates
    if (points?.length && !navigation) {
      const bounds = points.reduce((value, point) => value.extend(point), new mapboxgl.LngLatBounds(points[0], points[0]))
      map.fitBounds(bounds, { padding: { top: 60, bottom: 72, left: 390, right: 70 }, maxZoom: 15 })
    }
  }, [rankedRoutes, selected, mapReady, navigation, routeMode])

  function setPlace(which, place) {
    const value = { name: place.name, label: place.label, coordinates: place.coordinates }
    if (which === 'source') { setSource(value); sourceRef.current = value }
    else { setDestination(value); destinationRef.current = value }
  }

  function persistPosition(position, navigating = false) {
    const coordinates = [position.coords.longitude, position.coords.latitude]
    latestCoordinatesRef.current = coordinates
    latestPositionRef.current = position
    const payload = {
      latitude: coordinates[1], longitude: coordinates[0],
      accuracy: position.coords.accuracy, heading: position.coords.heading,
      speed: position.coords.speed, navigating
    }
    locationSaveQueueRef.current = locationSaveQueueRef.current
      .catch(() => {})
      .then(() => API.saveLocation(payload))
      .catch(error => setMessage(error.message))
    return coordinates
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setMessage('This browser does not provide location access.'); return }
    setMessage('')
    navigator.geolocation.getCurrentPosition(position => {
      const coordinates = persistPosition(position)
      const currentSource = { name: 'Current location', label: 'Current location', coordinates }
      setSource(currentSource)
      sourceRef.current = currentSource
      if (mapRef.current) {
        locationMarkerRef.current?.remove()
        locationMarkerRef.current = new mapboxgl.Marker({ color: '#1f68c5' }).setLngLat(coordinates).setPopup(new mapboxgl.Popup().setText('Current location')).addTo(mapRef.current)
        mapRef.current.flyTo({ center: coordinates, zoom: 14 })
      }
    }, () => setMessage('Location permission was denied or your position is unavailable.'), { enableHighAccuracy: true, timeout: 12000 })
  }

  useEffect(() => { useCurrentLocation() }, [])

  async function compareRoutes(from = source, to = destination, currentPosition = null) {
    if (!from || !to) { setMessage('Choose both a start point and a destination.'); return }
    const origin = currentPosition || from.coordinates
    if (isSamePlace(origin, to.coordinates)) {
      setRoutes([])
      setSelected(0)
      setOffRoute(false)
      setMessage("You're already at your destination.")
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const calculated = await getAllRoutes(origin, to.coordinates)
      const next = calculated.sort((a, b) => a.duration - b.duration)
      setRoutes(next)
      setSelected(0)
      setOffRoute(false)
      if (!next.length) setMessage('No routes were returned for those places.')
    } catch (error) {
      if (error.name !== 'AbortError') setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  function stopNavigation() {
    navigationActiveRef.current = false
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current)
    watchRef.current = null
    if (latestPositionRef.current) persistPosition(latestPositionRef.current, false)
    else if (latestCoordinatesRef.current) API.saveLocation({ latitude: latestCoordinatesRef.current[1], longitude: latestCoordinatesRef.current[0], navigating: false }).catch(error => setMessage(error.message))
    gpsMarkerRef.current?.remove()
    gpsMarkerRef.current = null
    reroutingRef.current = false
    setNavigation(false)
    setLiveLocation(null)
    setOffRoute(false)
    mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 450 })
  }

  function startNavigation() {
    if (!selectedRoute) return
    if (!navigator.geolocation) { setMessage('Live navigation requires browser location support.'); return }
    setMessage('')
    navigator.geolocation.getCurrentPosition(position => {
      const firstPosition = persistPosition(position, true)
      lastLocationSaveRef.current = Date.now()
      navigationActiveRef.current = true
      setNavigation(true)
      const remaining = remainingRouteMeters(firstPosition, selectedRoute.geometry.coordinates)
      const arrived = hasArrivedAtDestination(firstPosition, destinationRef.current?.coordinates, remaining)
      setLiveLocation({ coordinates: firstPosition, heading: position.coords.heading, remaining, arrived })
      gpsMarkerRef.current = new mapboxgl.Marker({ color: '#1f68c5' }).setLngLat(firstPosition).addTo(mapRef.current)
      mapRef.current?.easeTo({ center: firstPosition, zoom: 16, pitch: 48, duration: 700 })
      watchRef.current = navigator.geolocation.watchPosition(nextPosition => {
        if (!navigationActiveRef.current) return
        const coordinates = [nextPosition.coords.longitude, nextPosition.coords.latitude]
        latestCoordinatesRef.current = coordinates
        latestPositionRef.current = nextPosition
        if (Date.now() - lastLocationSaveRef.current >= 8000) {
          persistPosition(nextPosition, true)
          lastLocationSaveRef.current = Date.now()
        }
        if (sourceRef.current) sourceRef.current = { ...sourceRef.current, coordinates }
        const route = selectedRouteRef.current
        const remaining = route ? remainingRouteMeters(coordinates, route.geometry.coordinates) : 0
        const arrived = hasArrivedAtDestination(coordinates, destinationRef.current?.coordinates, remaining)
        setLiveLocation({ coordinates, heading: nextPosition.coords.heading, remaining, arrived })
        gpsMarkerRef.current?.setLngLat(coordinates)
        mapRef.current?.easeTo({ center: coordinates, bearing: Number.isFinite(nextPosition.coords.heading) ? nextPosition.coords.heading : mapRef.current.getBearing(), duration: 500 })
        if (!route) return
        const distance = distanceToRouteMeters(coordinates, route.geometry.coordinates)
        const isOffRoute = !arrived && distance > 90
        setOffRoute(isOffRoute)
        if (isOffRoute && !reroutingRef.current) {
          const nextDestination = destinationRef.current
          reroutingRef.current = true
          if (nextDestination && sourceRef.current) compareRoutes(sourceRef.current, nextDestination, coordinates).finally(() => { reroutingRef.current = false })
        }
      }, () => { setMessage('Live GPS updates stopped. Check location permission and signal.'); stopNavigation() }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 })
    }, () => setMessage('Allow location access to start live navigation.'), { enableHighAccuracy: true, timeout: 12000 })
  }

  useEffect(() => () => {
    navigationActiveRef.current = false
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current)
  }, [])

  const progress = selectedRoute && liveLocation ? 1 - liveLocation.remaining / Math.max(1, selectedRoute.distance) : 0
  const steps = selectedRoute?.legs?.[0]?.steps || []
  const arrived = Boolean(liveLocation?.arrived)
  let stepDistance = 0
  const nextStep = arrived ? 'Arrived at destination' : steps.find(step => {
    stepDistance += step.distance
    return stepDistance / Math.max(1, selectedRoute?.distance || 1) >= progress
  })?.maneuver?.instruction || 'Continue along the selected route'

  return <div className="explore-layout">
    <section className="explore-panel" aria-label="Route planning">
      <div className="explore-heading"><span className="eyebrow">Explore Mangaluru</span><h1>Plan a journey</h1><p>Compare travel time with confirmed incident reports along the route.</p></div>
      {navigation ? <div className="navigation-summary">
        <button type="button" className="back-link" onClick={stopNavigation}><ArrowLeft size={16} /> Back to route options</button>
        <div className="live-indicator"><span /> LIVE LOCATION</div>
        <strong>{arrived ? 'Arrived' : `${formatDuration((selectedRoute?.duration || 0) * (liveLocation ? liveLocation.remaining / Math.max(1, selectedRoute?.distance || 1) : 1))} remaining`}</strong>
        <span>{arrived ? `At ${destination?.name}` : `${formatDistance(liveLocation?.remaining ?? selectedRoute?.distance ?? 0)} · ${destination?.name}`}</span>
        <div className="next-turn"><Navigation size={19} /><span>{nextStep}</span><ArrowUpRight size={17} /></div>
        {offRoute && <div className="route-warning">Route deviation detected. Recalculating from your location…</div>}
        <ExposureSummary score={selectedRoute?.score} incidentCount={selectedRoute?.incidentCount} />
        <button type="button" className="button-danger" onClick={stopNavigation}><X size={16} /> {arrived ? 'Finish navigation' : 'Stop navigation'}</button>
      </div> : <>
        <PlaceSearch label="Start" value={source?.label || ''} onChange={value => { const next = value ? { name: value, label: value, coordinates: null } : null; setSource(next); sourceRef.current = next }} onSelect={place => setPlace('source', place)} onCurrentLocation={useCurrentLocation} current />
        <PlaceSearch label="Destination" value={destination?.label || ''} onChange={value => { setDestination(value ? { name: value, label: value, coordinates: null } : null); destinationRef.current = null }} onSelect={place => setPlace('destination', place)} />
        <button type="button" className="button-primary" disabled={busy || !source?.coordinates || !destination?.coordinates} onClick={() => compareRoutes()}>
          {busy ? 'Finding routes…' : 'Compare routes'}
        </button>
        {message && <div className="inline-message" role="status">{message}</div>}
        {rankedRoutes.length > 0 && <div className="route-options">
          <div className="section-heading"><h2>Route options</h2><span>{scoredRoutes.length} found</span></div>
          <div className="route-mode-toggle" role="group" aria-label="Route preference">
            <button type="button" aria-pressed={routeMode === 'fastest'} className={routeMode === 'fastest' ? 'active' : ''} onClick={() => { setRouteMode('fastest'); setSelected(0) }}>Fastest</button>
            <button type="button" aria-pressed={routeMode === 'safest'} className={routeMode === 'safest' ? 'active' : ''} onClick={() => { setRouteMode('safest'); setSelected(0) }}>Safest</button>
          </div>
          {rankedRoutes.map((route, index) => <button key={`${route.distance}-${route.duration}`} className={`route-option${selected === index ? ' selected' : ''}`} onClick={() => setSelected(index)}>
            <span className="route-option-top"><strong>{routeMode === 'fastest' ? 'Quickest route' : `${safetyLabel(route.score)} · ${route.score}/100`}</strong><span>{formatDuration(route.duration)}</span></span>
            <span className="route-option-sub">{formatDistance(route.distance)} · {route.incidentCount} nearby {route.incidentCount === 1 ? 'incident' : 'incidents'} · Safety {route.score}/100</span>
            <span className="route-safety-track" aria-label={`Safety score ${route.score} out of 100`}><span style={{ width: `${route.score}%`, backgroundColor: safetyColor(route.score) }} /></span>
          </button>)}
          <p className="route-caveat"><Shield size={14} /> Reports are incomplete and do not predict personal safety.</p>
          <button type="button" className="button-primary" onClick={startNavigation}><Navigation size={16} /> Start navigation</button>
        </div>}
      </>}
      {!hasMapboxToken() && <div className="config-note"><strong>Map service needs a token</strong><span>Set VITE_MAPBOX_ACCESS_TOKEN in frontend/.env.local. Restrict the public token to your app domains.</span></div>}
    </section>
    <div className="explore-map-wrap">
      <div ref={mapElement} className="explore-map" aria-label="Map showing confirmed safety incidents and routes" />
      {!hasMapboxToken() && <div className="map-config-overlay"><MapPin size={26} /><strong>Mapbox is not configured</strong><span>Location search, maps, and routes become available after adding the public token.</span></div>}
      {mapReady && incidents.length > 0 && <div className="map-legend"><span className="legend-dot" /> Confirmed incidents</div>}
      {liveLocation && <div className="map-live-chip"><span /> GPS tracking on</div>}
    </div>
  </div>
}

function ExposureSummary({ score, incidentCount }) {
  return <div className="exposure-summary"><Shield size={17} /><div><span>{safetyLabel(score ?? 0)} · {score ?? '--'}/100</span><small>{incidentCount ?? 0} confirmed incidents within 300 m · not a safety guarantee</small></div></div>
}