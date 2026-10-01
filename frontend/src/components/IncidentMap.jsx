import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { LocateFixed, MapPin } from 'lucide-react'
import { API } from '../api/client'
import { hasMapboxToken } from '../utils/mapbox'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

export default function IncidentMap() {
  const element = useRef(null)
  const mapRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [incidents, setIncidents] = useState([])

  async function loadIncidents() {
    try { setIncidents(await API.publicIncidents({ limit: 100 })); setMessage('') }
    catch (error) { setMessage(error.message) }
  }
  useEffect(() => { loadIncidents() }, [])
  useAutoRefresh(loadIncidents, 30000)

  useEffect(() => {
    if (!element.current || !hasMapboxToken()) return undefined
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
    const map = new mapboxgl.Map({ container: element.current, style: 'mapbox://styles/mapbox/streets-v12', center: [74.843, 12.870], zoom: 11 })
    mapRef.current = map
    map.on('load', () => setReady(true))
    map.on('error', event => setMessage(event.error?.message || 'Map tiles could not be loaded.'))
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return undefined
    const markers = incidents.flatMap(incident => {
      const point = [Number(incident.longitude), Number(incident.latitude)]
      if (!point.every(Number.isFinite)) return []
      const element = document.createElement('span')
      element.className = `incident-map-dot severity-${String(incident.severity || 'low').toLowerCase()}`
      element.setAttribute('aria-label', `${incident.category || 'Incident'}, confirmed`)
      const content = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = String(incident.category || 'Incident').replaceAll('_', ' ')
      const address = document.createElement('span')
      address.textContent = incident.address || 'Mangaluru district'
      const when = document.createElement('small')
      when.textContent = incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Recently reported'
      content.append(title, address, when)
      const popup = new mapboxgl.Popup({ offset: 12 }).setDOMContent(content)
      return [new mapboxgl.Marker({ element }).setLngLat(point).setPopup(popup).addTo(mapRef.current)]
    })
    return () => markers.forEach(marker => marker.remove())
  }, [incidents, ready])

  function locate() {
    if (!navigator.geolocation) { setMessage('Location is unavailable in this browser.'); return }
    setMessage('')
    navigator.geolocation.getCurrentPosition(position => {
      const center = [position.coords.longitude, position.coords.latitude]
      mapRef.current?.flyTo({ center, zoom: 14 })
      const marker = new mapboxgl.Marker({ color: '#1f68c5' }).setLngLat(center).setPopup(new mapboxgl.Popup().setText('Current location')).addTo(mapRef.current)
      window.setTimeout(() => marker.remove(), 10000)
    }, () => setMessage('Allow location access to center the map on your current location.'), { enableHighAccuracy: true, timeout: 12000 })
  }

  return <div className="home-map-frame">
    <div className="home-map" ref={element} aria-label="Confirmed safety incidents around Mangaluru" />
    {hasMapboxToken() ? <button type="button" className="map-recenter" onClick={locate} title="Center on my location" aria-label="Center on my location"><LocateFixed size={18} /></button> : <div className="map-config-overlay"><MapPin size={22} /><strong>Mapbox needs configuration</strong><span>Add a restricted public token to frontend/.env.local.</span></div>}
    {message && <span className="home-map-message" role="status">{message}</span>}
    <span className="home-map-legend"><i /> Confirmed incidents</span>
  </div>
}