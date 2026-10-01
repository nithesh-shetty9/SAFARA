import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function CommandMap({ incidents = [] }) {
  const element = useRef(null)
  const mapRef = useRef(null)
  const markers = useRef([])
  const hasInitialFit = useRef(false)
  const markerSignature = JSON.stringify(incidents.map(({ id, latitude, longitude, category, severity, status, address }) => [id, latitude, longitude, category, severity, status, address]))

  useEffect(() => {
    if (!element.current) return undefined
    const map = L.map(element.current, { zoomControl: false }).setView([12.870, 74.843], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined
    markers.current.forEach(marker => marker.remove())
    markers.current = incidents.flatMap(incident => {
      const lat = Number(incident.latitude)
      const lng = Number(incident.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
      const severity = String(incident.severity || '').toLowerCase()
      const marker = L.circleMarker([lat, lng], {
        radius: severity === 'critical' ? 9 : severity === 'high' ? 8 : 6,
        color: '#fff', weight: 2, fillColor: severity === 'critical' || severity === 'high' ? '#c6413b' : '#db7150', fillOpacity: .9
      })
      const popup = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = String(incident.category || 'Incident').replaceAll('_', ' ')
      const location = document.createElement('div')
      location.textContent = incident.address || 'Mangaluru district'
      const status = document.createElement('small')
      status.textContent = `${String(incident.severity || 'unknown').toUpperCase()} · ${String(incident.status || 'unknown').replaceAll('_', ' ')}`
      popup.append(title, location, status)
      marker.bindPopup(popup)
      marker.addTo(map)
      return [marker]
    })
    if (markers.current.length > 0 && !hasInitialFit.current) {
      map.fitBounds(L.featureGroup(markers.current).getBounds().pad(.18), { maxZoom: 14 })
      hasInitialFit.current = true
    }
    return () => markers.current.forEach(marker => marker.remove())
  }, [markerSignature])

  return <div className="command-map" ref={element} aria-label="District incident map" />
}