import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FilePlus2, MapPinned, Plus, RefreshCw } from 'lucide-react'
import { API } from '../api/client'
import { useAuth } from '../context/AuthContext'
import EmergencyContacts from '../components/EmergencyContacts'
import ReportForm from '../components/ReportForm'
import SosPanel from '../components/SosPanel'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const ExploreMap = lazy(() => import('../components/ExploreMap'))
const IncidentMap = lazy(() => import('../components/IncidentMap'))

export function UserHome() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [error, setError] = useState('')
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  async function load() {
    try { setIncidents(await API.publicIncidents({ limit: 4 })); setError('') }
    catch (loadError) { setError(loadError.message) }
  }
  useEffect(() => { load() }, [])
  useAutoRefresh(load, 30000)

  return <div className="user-home page-pad">
    <header className="home-welcome"><div><span className="eyebrow">SAFARA · MANGALURU</span><h1>{greeting}, {user?.name?.split(' ')[0] || 'there'}</h1><p>Stay aware. Travel safer.</p></div><Link className="button-outline" to="/app/report"><FilePlus2 size={16} /> Report incident</Link></header>
    <Link to="/app/explore" className="home-search"><MapPinned size={18} /><span>Where do you want to go?</span><ArrowRight size={18} /></Link>
    <section className="home-section"><div className="section-heading"><div><span className="eyebrow">District activity</span><h2>Confirmed incident map</h2></div><Link to="/app/explore" className="text-link">Explore routes <ArrowRight size={15} /></Link></div><Suspense fallback={<div className="home-map-frame"><div className="empty-state">Loading map…</div></div>}><IncidentMap /></Suspense></section>
    <section className="home-section"><div className="section-heading"><div><span className="eyebrow">Latest updates</span><h2>Recent confirmed reports</h2></div><button className="bare-icon" type="button" onClick={load} title="Refresh reports" aria-label="Refresh reports"><RefreshCw size={17} /></button></div>
      {error && <div className="inline-message" role="status">{error}</div>}
      {incidents.length === 0 ? <div className="empty-state">No confirmed incidents are available to display.</div> : <div className="public-incident-list">{incidents.map(incident => <article key={incident.id}><span className="incident-indicator" /><div><strong>{String(incident.category || 'Incident').replaceAll('_', ' ')}</strong><span>{incident.address || 'Mangaluru district'} · {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Recently'}</span></div><span className={`severity-label severity-${String(incident.severity || 'low').toLowerCase()}`}>{incident.severity}</span></article>)}</div>}
    </section>
    <Link className="home-report-cta" to="/app/reports"><span><FilePlus2 size={19} /><strong>Your reports</strong></span><span>View status and review history <ArrowRight size={16} /></span></Link>
  </div>
}

export function UserExplore() { return <Suspense fallback={<div className="empty-state">Loading map tools…</div>}><ExploreMap /></Suspense> }

const reportFilters = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Rejected', value: 'REJECTED' }
]

export function UserReports() {
  const [reports, setReports] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() {
    setLoading(true)
    try { setReports(await API.incidents({ limit: 100 })); setError('') }
    catch (loadError) { setError(loadError.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useAutoRefresh(load, 15000)
  const visible = reports.filter(report => !filter || report.status === filter)
  return <section className="user-list-page page-pad">
    <div className="page-heading"><span className="eyebrow">Your activity</span><h1>My reports</h1><p>Track review status for incidents submitted from your account.</p></div>
    <div className="list-toolbar"><div className="segmented-filter" role="group" aria-label="Filter reports by status">{reportFilters.map(item => <button key={item.value} type="button" className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div><Link to="/app/report" className="button-primary"><Plus size={16} /> New report</Link></div>
    {error && <div className="inline-message" role="alert">{error}</div>}
    {loading ? <div className="empty-state">Loading your reports…</div> : visible.length ? <div className="report-list">{visible.map(report => <article className="report-row" key={report.id}><span className="report-kind"><FilePlus2 size={17} /></span><div className="report-row-main"><strong>{String(report.category || 'Incident').replaceAll('_', ' ')}</strong><span>{report.address || 'Location recorded'} · {report.created_at ? new Date(report.created_at).toLocaleString() : 'Date unavailable'}</span><p>{report.description}</p></div><span className={`status-badge status-${String(report.status || 'pending').toLowerCase()}`}>{String(report.status || 'Pending').replaceAll('_', ' ')}</span></article>)}</div> : <div className="empty-state">No reports match this filter.</div>}
    <button type="button" className="subtle-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button>
  </section>
}

export function UserReportCreate() { return <ReportForm /> }
export function UserSos() { return <SosPanel /> }
export function UserContacts() { return <EmergencyContacts /> }

export function UserProfile() {
  const { user, logout } = useAuth()
  return <section className="profile-page page-pad"><div className="page-heading"><span className="eyebrow">Account</span><h1>Profile</h1></div><div className="profile-details"><div className="profile-avatar">{user?.name?.trim()?.charAt(0)?.toUpperCase() || 'S'}</div><div><strong>{user?.name}</strong><span>{user?.email}</span><small>{user?.role === 'USER' ? 'SAFARA resident' : user?.role}</small></div></div><button type="button" className="button-outline profile-signout" onClick={logout}>Sign out</button></section>
}
