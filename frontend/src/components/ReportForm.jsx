import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, MapPin, Search } from 'lucide-react'
import { API } from '../api/client'
import { searchPlaces } from '../utils/mapbox'
import { getAccuratePosition } from '../utils/geo'

export default function ReportForm() {
  const [description, setDescription] = useState('')
  const [place, setPlace] = useState(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  useEffect(() => {
    if (query.trim().length < 2) { setSuggestions([]); return undefined }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchPlaces(query, controller.signal).then(setSuggestions).catch(error => {
        if (error.name !== 'AbortError') setMessage(error.message)
      })
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])

  function useLocation() {
    setMessage('')
    getAccuratePosition().then(position => {
      setPlace({ name: 'Current location', label: 'Device GPS', coordinates: [position.coords.longitude, position.coords.latitude] })
      setQuery('')
    }).catch(() => setMessage('Allow location access or search for the incident location.'))
  }

  async function submit(event) {
    event.preventDefault()
    if (!description.trim()) return setMessage('Describe what happened before submitting.')
    if (!place?.coordinates) return setMessage('Choose a location or use your current location.')
    setBusy(true)
    setMessage('')
    try {
      const result = await API.createIncident({
        description: description.trim(),
        longitude: place.coordinates[0],
        latitude: place.coordinates[1],
        address: place.label.slice(0, 255)
      })
      setSubmitted(result.incident)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) return <section className="form-page">
    <Link to="/app/reports" className="back-link"><ArrowLeft size={16} /> My reports</Link>
    <div className="report-success"><span className="success-icon"><Check size={24} /></span><h1>Report submitted</h1><p>Your report is recorded and will be reviewed.</p>
      <div className="classification-result"><span>AI classification</span><strong>{String(submitted.category || 'other').replaceAll('_', ' ')} · {submitted.severity}</strong><small>Classification is automated and may need review.</small></div>
      <span className="status-badge status-pending">{String(submitted.status || 'PENDING').replaceAll('_', ' ')}</span>
      <Link to="/app/reports" className="button-primary">View my reports</Link>
    </div>
  </section>

  return <section className="form-page">
    <Link to="/app/reports" className="back-link"><ArrowLeft size={16} /> My reports</Link>
    <div className="page-heading"><span className="eyebrow">Community report</span><h1>Report an incident</h1><p>Share what happened and where. SAFARA classifies the description for review.</p></div>
    <form className="report-form" onSubmit={submit}>
      <div className="field"><label htmlFor="incident-description">What happened?</label><textarea id="incident-description" maxLength={5000} rows={6} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the incident. Avoid including names or sensitive personal details." required /><small>{description.length} / 5000</small></div>
      <div className="field location-field"><label>Where did it happen?</label>
        <button className="location-pick" type="button" onClick={useLocation}><MapPin size={16} /> Use my current location</button>
        <div className="place-search-field"><Search size={17} /><input value={place?.label || query} onChange={event => { setPlace(null); setQuery(event.target.value) }} placeholder="Search location" autoComplete="off" /></div>
        {suggestions.length > 0 && <div className="place-suggestions">{suggestions.map(item => <button type="button" key={item.id} onClick={() => { setPlace(item); setQuery(''); setSuggestions([]) }}><MapPin size={16} /><span><strong>{item.name}</strong><small>{item.label}</small></span></button>)}</div>}
        {place && <div className="selected-place"><MapPin size={15} /> {place.label}</div>}
      </div>
      {message && <div className="inline-message" role="alert">{message}</div>}
      <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Submitting report…' : 'Submit report'}</button>
    </form>
  </section>
}