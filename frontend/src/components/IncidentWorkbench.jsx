import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { API } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ADMIN_ROLES } from '../utils/helpers'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const statuses = ['', 'PENDING', 'ASSIGNED', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'RESOLVED', 'ARCHIVED']
const severities = ['', 'critical', 'high', 'medium', 'low']
const categories = ['stalking', 'harassment', 'assault', 'theft', 'accident', 'poor_lighting', 'unsafe_area', 'suspicious_activity', 'safe_zone', 'other']

export default function IncidentWorkbench({ officer = false }) {
  const { user } = useAuth()
  const isAdmin = ADMIN_ROLES.includes(user?.role)
  const [items, setItems] = useState([])
  const [officers, setOfficers] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', severity: '' })
  const [selected, setSelected] = useState(null)
  const [assignedTo, setAssignedTo] = useState('')
  const [classification, setClassification] = useState({ category: '', severity: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const loaded = useRef(false)
  const pending = useRef(null)

  async function load() {
    if (pending.current) return pending.current
    if (!loaded.current) setLoading(true)
    const request = (async () => {
      try {
        const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
        const result = await API.incidents({ ...params, limit: 100 })
        setItems(result)
        setMessage('')
      } catch (error) { setMessage(error.message) }
      finally { loaded.current = true; setLoading(false); pending.current = null }
    })()
    pending.current = request
    return request
  }

  useEffect(() => { load() }, [filters.search, filters.status, filters.severity])
  useAutoRefresh(load, 15000)

  async function openIncident(incident) {
    setSelected(incident)
    setClassification({ category: incident.category || '', severity: incident.severity || '' })
    setMessage('')
    if (isAdmin) API.adminOfficers().then(setOfficers).catch(() => setOfficers([]))
    try { const result = await API.incident(incident.id); setSelected(result.incident); setClassification({ category: result.incident.category || '', severity: result.incident.severity || '' }) }
    catch (error) { setMessage(error.message) }
  }

  async function updateStatus(status) {
    if (!selected) return
    setBusy(true)
    try {
      const result = await API.reviewIncident(selected.id, { status })
      setSelected(result.incident)
      setItems(current => current.map(item => item.id === selected.id ? result.incident : item))
      setMessage(`Incident moved to ${status.replaceAll('_', ' ').toLowerCase()}.`)
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  async function assign() {
    if (!assignedTo || !selected) return
    setBusy(true)
    try {
      await API.assignIncident(selected.id, Number(assignedTo))
      const result = await API.incident(selected.id)
      setSelected(result.incident)
      await load()
      setMessage('Incident assigned.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  async function correctClassification() {
    setBusy(true)
    try {
      const result = await API.correctClassification(selected.id, classification)
      setSelected(result.incident)
      setItems(current => current.map(item => item.id === selected.id ? result.incident : item))
      setMessage('Classification updated.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return <section className="command-page">
    <div className="command-page-heading"><div><span className="eyebrow">{officer ? 'Review desk' : 'District operations'}</span><h1>{officer ? 'Incident queue' : 'Incidents'}</h1><p>{officer ? 'Review reports, classification, and incident status.' : 'Search and review submitted safety incidents.'}</p></div><button className="command-outline-button" type="button" onClick={load}>Refresh</button></div>
    <div className="command-filters"><label className="command-search"><Search size={16} /><input value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Search description or location" /></label><select aria-label="Filter by status" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>{statuses.map(status => <option key={status} value={status}>{status ? status.replaceAll('_', ' ') : 'All statuses'}</option>)}</select><select aria-label="Filter by severity" value={filters.severity} onChange={event => setFilters({ ...filters, severity: event.target.value })}>{severities.map(severity => <option key={severity} value={severity}>{severity ? severity.toUpperCase() : 'All severity'}</option>)}</select></div>
    {message && !selected && <div className="inline-message" role="alert">{message}</div>}
    <div className="command-table-wrap"><table className="command-table"><thead><tr><th>ID</th><th>Incident</th><th>Location</th><th>Severity</th><th>Status</th><th>Reported</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="6" className="table-empty">Loading incidents…</td></tr> : items.length ? items.map(item => <tr key={item.id} onClick={() => openIncident(item)} tabIndex="0" onKeyDown={event => event.key === 'Enter' && openIncident(item)}><td>#{item.id}</td><td><strong>{String(item.category || 'other').replaceAll('_', ' ')}</strong><small>{item.description}</small></td><td>{item.address || 'Location recorded'}</td><td><span className={`severity-chip severity-${String(item.severity || '').toLowerCase()}`}>{item.severity}</span></td><td><span className={`status-badge status-${String(item.status || '').toLowerCase()}`}>{String(item.status || '').replaceAll('_', ' ')}</span></td><td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</td></tr>) : <tr><td colSpan="6" className="table-empty">No incidents match those filters.</td></tr>}
    </tbody></table></div>
    {selected && <div className="drawer-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><aside className="incident-drawer" role="dialog" aria-modal="true" aria-labelledby="incident-drawer-title"><header><div><span className="eyebrow">Incident #{selected.id}</span><h2 id="incident-drawer-title">{String(selected.category || 'Incident').replaceAll('_', ' ')}</h2></div><button className="bare-icon" type="button" onClick={() => setSelected(null)} aria-label="Close incident"><X size={20} /></button></header>
      <div className="drawer-scroll"><div className="drawer-badges"><span className={`severity-chip severity-${String(selected.severity || '').toLowerCase()}`}>{selected.severity}</span><span className={`status-badge status-${String(selected.status || '').toLowerCase()}`}>{String(selected.status || '').replaceAll('_', ' ')}</span></div><div className="drawer-detail"><span>Location</span><strong>{selected.address || 'Coordinates recorded'}</strong><small>{selected.latitude}, {selected.longitude}</small></div><div className="drawer-detail"><span>Description</span><p>{selected.description}</p></div><div className="drawer-detail"><span>AI classification</span><strong>{selected.ai_category || selected.category} · {selected.ai_severity || selected.severity}</strong><small>{selected.ai_confidence != null ? `${Math.round(Number(selected.ai_confidence) * 100)}% confidence` : 'Confidence unavailable'}</small></div>
      {isAdmin && <div className="drawer-detail"><span>Assign officer</span><div className="drawer-inline-form"><select value={assignedTo} onChange={event => setAssignedTo(event.target.value)}><option value="">Select an active officer</option>{officers.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.name} · {item.role.replaceAll('_', ' ')}</option>)}</select><button className="command-primary-button" type="button" disabled={!assignedTo || busy} onClick={assign}>Assign</button></div></div>}
      <div className="drawer-detail"><span>Correct classification</span><div className="drawer-inline-form"><select aria-label="Category" value={classification.category} onChange={event => setClassification({ ...classification, category: event.target.value })}>{categories.map(category => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select><select aria-label="Severity" value={classification.severity} onChange={event => setClassification({ ...classification, severity: event.target.value })}>{severities.filter(Boolean).map(severity => <option key={severity} value={severity}>{severity}</option>)}</select></div><button className="command-outline-button drawer-save" type="button" disabled={busy} onClick={correctClassification}>Save classification</button></div>
      <div className="drawer-actions"><span>Review status</span><div>{['UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'RESOLVED'].map(status => <button key={status} type="button" className={status === 'REJECTED' ? 'command-danger-button' : 'command-outline-button'} disabled={busy || selected.status === status} onClick={() => updateStatus(status)}>{status.replaceAll('_', ' ')}</button>)}</div></div>
      {message && <div className="inline-message" role="status">{message}</div>}</div>
    </aside></div>}
  </section>
}