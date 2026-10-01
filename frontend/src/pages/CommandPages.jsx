import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, Check, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { API } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../utils/helpers'
import CommandMap from '../components/CommandMap'
import IncidentWorkbench from '../components/IncidentWorkbench'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const number = value => Number(value || 0).toLocaleString()
const date = value => value ? new Date(value).toLocaleString() : '—'

function useRequest(load, dependencies = [], intervalMs = 20000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const loaded = useRef(false)
  const pending = useRef(null)
  const loadRef = useRef(load)
  loadRef.current = load
  async function refresh() {
    if (pending.current) return pending.current
    const request = (async () => {
      if (!loaded.current) setLoading(true)
      try { setData(await loadRef.current()); setError('') }
      catch (requestError) { setError(requestError.message) }
      finally { loaded.current = true; setLoading(false); pending.current = null }
    })()
    pending.current = request
    return request
  }
  useEffect(() => { refresh() }, dependencies)
  useAutoRefresh(refresh, intervalMs)
  return { data, error, loading, refresh }
}

function CommandHeading({ eyebrow, title, subtitle, action }) {
  return <div className="command-page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

function Stats({ items }) {
  return <div className="command-stat-grid">{items.map(([label, value, note, tone]) => <div className={`command-stat${tone ? ` tone-${tone}` : ''}`} key={label}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>)}</div>
}

function ChartRows({ title, rows, nameKey, valueKey }) {
  const maximum = Math.max(1, ...rows.map(row => Number(row[valueKey] || 0)))
  return <section className="command-panel"><header><h2>{title}</h2><span>{rows.length} categories</span></header>{rows.length ? <div className="chart-rows">{rows.map((row, index) => <div className="chart-row" key={`${row[nameKey]}-${index}`}><div><span>{String(row[nameKey] || 'Unspecified').replaceAll('_', ' ')}</span><strong>{number(row[valueKey])}</strong></div><i><b style={{ width: `${Math.max(3, Number(row[valueKey] || 0) / maximum * 100)}%` }} /></i></div>)}</div> : <div className="panel-empty">No statistics are available.</div>}</section>
}

function IncidentRows({ items, limit = 6 }) {
  return items.slice(0, limit).map(item => <div className="compact-incident" key={item.id}><span className={`incident-severity-dot severity-${String(item.severity || '').toLowerCase()}`} /><div><strong>{String(item.category || 'Incident').replaceAll('_', ' ')}</strong><span>{item.address || 'Location recorded'} · {date(item.created_at)}</span></div><span className={`status-badge status-${String(item.status || '').toLowerCase()}`}>{String(item.status || '').replaceAll('_', ' ')}</span></div>)
}

export function AdminOverview() {
  const { data, error, loading, refresh } = useRequest(() => API.adminDashboard(), [], 15000)
  const stats = data?.stats || {}
  return <section className="command-page">
    <CommandHeading eyebrow="District Command Center" title="Mangaluru District" subtitle="Karnataka · District operations overview" action={<button className="command-outline-button" type="button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>} />
    {error && <div className="inline-message" role="alert">{error}</div>}
    <Stats items={[
      ['Active incidents', loading ? '—' : number(stats.active_incidents), 'Pending, assigned, or under review', 'red'],
      ['Pending review', loading ? '—' : number(stats.pending_review), 'Awaiting an initial decision', 'amber'],
      ['Confirmed today', loading ? '—' : number(stats.confirmed_today), 'District reports', 'green'],
      ['Active SOS', loading ? '—' : number(stats.active_sos), 'Active or acknowledged', 'red'],
      ['Officers active', loading ? '—' : number(stats.active_officers), 'Enabled officer accounts', 'teal']
    ]} />
    <div className="command-overview-grid"><section className="command-panel command-map-panel"><header><h2>District incident map</h2><span>{data?.incidents?.length || 0} recent records</span></header><CommandMap incidents={data?.incidents || []} /></section><section className="command-panel"><header><h2>Recent incidents</h2><Link to="/admin/incidents">Open queue <ExternalLink size={14} /></Link></header><div className="compact-list">{data?.incidents?.length ? <IncidentRows items={data.incidents} /> : <div className="panel-empty">{loading ? 'Loading incident activity…' : 'No incidents to display.'}</div>}</div></section></div>
    <section className="intelligence-strip"><div className="intelligence-icon"><Activity size={19} /></div><div><span>District reported-incident index</span><strong>{loading ? '—' : `${number(data?.safety_score)} / 100`}</strong><small>Backend score from confirmed and resolved reports in the last 30 days. It is not a guarantee of safety.</small></div><Link to="/admin/analytics">View analytics <ExternalLink size={14} /></Link></section>
  </section>
}

export function AdminIncidents() { return <IncidentWorkbench /> }

export function AdminOfficers() {
  const { data, error, loading, refresh } = useRequest(() => API.adminOfficers(), [], 30000)
  return <section className="command-page"><CommandHeading eyebrow="Operations staff" title="Officers" subtitle="Active field officer accounts available for incident assignment." action={<button className="command-outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>} />
    {error && <div className="inline-message" role="alert">{error}</div>}
    <div className="command-table-wrap"><table className="command-table"><thead><tr><th>Officer</th><th>Role</th><th>Account status</th><th>Trust score</th></tr></thead><tbody>{loading ? <tr><td colSpan="4" className="table-empty">Loading officers…</td></tr> : data?.length ? data.map(officer => <tr key={officer.id}><td><strong>{officer.name}</strong><small>{officer.email}</small></td><td>{roleLabel[officer.role] || officer.role}</td><td><span className={`status-badge status-${officer.status}`}>{officer.status}</span></td><td>{number(officer.trust_score)}</td></tr>) : <tr><td colSpan="4" className="table-empty">No officer accounts were found.</td></tr>}</tbody></table></div>
    <p className="command-footnote">Incident assignment is managed from an incident’s review panel.</p>
  </section>
}

export function AdminAnalytics() {
  const { data, error, loading, refresh } = useRequest(async () => {
    const [dashboard, severity, types, trend, hotspots] = await Promise.all([API.analyticsDashboard(), API.analyticsSeverity(), API.analyticsTypes(), API.analyticsTrend(30), API.analyticsHotspots()])
    return { dashboard, severity, types, trend, hotspots }
  }, [], 60000)
  const stats = data?.dashboard?.stats || {}
  return <section className="command-page"><CommandHeading eyebrow="District intelligence" title="Analytics" subtitle="Aggregated statistics supplied by the SAFARA backend." action={<button className="command-outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>} />
    {error && <div className="inline-message" role="alert">{error}</div>}
    <Stats items={[["Total active", loading ? '—' : number(stats.active_incidents), 'Current open queue', 'teal'], ['Pending review', loading ? '—' : number(stats.pending_review), 'Awaiting review', 'amber'], ['Confirmed today', loading ? '—' : number(stats.confirmed_today), 'Reviewed today', 'green'], ['Reported-incident index', loading ? '—' : `${number(data?.dashboard?.safety_score)} / 100`, '30-day backend score', 'red']]} />
    <div className="analytics-grid"><ChartRows title="Severity distribution" rows={data?.severity || []} nameKey="severity" valueKey="count" /><ChartRows title="Incident categories" rows={data?.types || []} nameKey="category" valueKey="count" /><ChartRows title="Reports over time · 30 days" rows={data?.trend || []} nameKey="day" valueKey="count" /><section className="command-panel"><header><h2>Area activity</h2><span>Top reported locations</span></header>{data?.hotspots?.length ? <div className="hotspot-list">{data.hotspots.map((spot, index) => <div key={`${spot.lat}-${spot.lng}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{spot.lat}, {spot.lng}</strong><small>{number(spot.incident_count)} incidents</small></div>)}</div> : <div className="panel-empty">No hotspot data is available.</div>}</section></div>
    <p className="command-footnote">Response-time statistics are not provided by the current API.</p>
  </section>
}

export function AdminTrust() {
  const { data, error, loading, refresh } = useRequest(() => API.adminTrust(), [], 30000)
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState('')
  async function changeStatus(user, status) {
    setBusyId(user.id)
    try { await API.updateUserStatus(user.id, status); await refresh(); setMessage(`Account status changed to ${status}.`) }
    catch (changeError) { setMessage(changeError.message) }
    finally { setBusyId(null) }
  }
  return <section className="command-page"><CommandHeading eyebrow="Trust & moderation" title="Account review" subtitle="Review account trust scores and report volume. Status changes are enforced by backend permissions." action={<button className="command-outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>} />
    {(error || message) && <div className="inline-message" role="status">{error || message}</div>}
    <div className="command-table-wrap"><table className="command-table"><thead><tr><th>Account</th><th>Reports</th><th>Trust score</th><th>Status</th><th>Moderation</th></tr></thead><tbody>{loading ? <tr><td colSpan="5" className="table-empty">Loading trust data…</td></tr> : data?.length ? data.map(user => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{number(user.reports)}</td><td>{number(user.trust_score)}</td><td><span className={`status-badge status-${user.status}`}>{user.status}</span></td><td><select disabled={busyId === user.id} aria-label={`Set account status for ${user.name}`} value={user.status} onChange={event => changeStatus(user, event.target.value)}>{['active', 'suspended', 'banned'].map(status => <option key={status}>{status}</option>)}</select></td></tr>) : <tr><td colSpan="5" className="table-empty">No user trust records found.</td></tr>}</tbody></table></div>
  </section>
}

export function AdminAlerts() {
  const { data, error, loading, refresh } = useRequest(async () => {
    const [dashboard, sos] = await Promise.all([API.adminDashboard(), API.sos()])
    return { alerts: dashboard.alerts || [], sos }
  }, [], 5000)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', type: 'warning', severity: 'medium' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function createAlert(event) {
    event.preventDefault(); setBusy(true)
    try { await API.createAlert(form); setForm({ title: '', message: '', type: 'warning', severity: 'medium' }); setFormOpen(false); await refresh(); setMessage('Operational alert created.') }
    catch (createError) { setMessage(createError.message) }
    finally { setBusy(false) }
  }
  async function markRead(id) {
    try { await API.markAlertRead(id); await refresh() }
    catch (readError) { setMessage(readError.message) }
  }
  async function updateSos(id, status) {
    try { await API.updateSOS(id, status); await refresh() }
    catch (updateError) { setMessage(updateError.message) }
  }
  return <section className="command-page"><CommandHeading eyebrow="District operations" title="Alerts" subtitle="Operational alerts and recorded SOS requests. Alert records do not mean emergency services were contacted." action={<><button className="command-outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button><button className="command-primary-button" onClick={() => setFormOpen(value => !value)}>Create alert</button></>} />
    {(error || message) && <div className="inline-message" role="status">{error || message}</div>}
    {formOpen && <form className="alert-create-form" onSubmit={createAlert}><label>Title<input required maxLength="190" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Message<textarea required maxLength="10000" rows="3" value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} /></label><div><label>Type<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>{['critical', 'warning', 'system'].map(value => <option key={value}>{value}</option>)}</select></label><label>Severity<select value={form.severity} onChange={event => setForm({ ...form, severity: event.target.value })}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value}>{value}</option>)}</select></label></div><button className="command-primary-button" disabled={busy}>{busy ? 'Creating…' : 'Publish alert'}</button></form>}
    <div className="alert-columns"><section className="command-panel"><header><h2>Operational alerts</h2><span>{data?.alerts?.length || 0}</span></header>{loading ? <div className="panel-empty">Loading alerts…</div> : data?.alerts?.length ? data.alerts.map(alert => <article className="alert-item" key={alert.id}><span className={`alert-mark severity-${String(alert.severity).toLowerCase()}`}><AlertTriangle size={17} /></span><div><div className="alert-item-title"><strong>{alert.title}</strong><span>{String(alert.severity).toUpperCase()}</span></div><p>{alert.message}</p><small>{date(alert.created_at)} · {alert.is_read ? 'Read' : 'Unread'}</small></div>{!alert.is_read && <button className="icon-action" type="button" title="Mark as read" aria-label="Mark alert as read" onClick={() => markRead(alert.id)}><Check size={16} /></button>}</article>) : <div className="panel-empty">No operational alerts recorded.</div>}</section>
      <section className="command-panel"><header><h2>SOS records</h2><span>{data?.sos?.filter(item => ['ACTIVE', 'ACKNOWLEDGED'].includes(item.status)).length || 0} active</span></header>{loading ? <div className="panel-empty">Loading SOS records…</div> : data?.sos?.length ? data.sos.slice(0, 20).map(item => <article className="sos-command-item" key={item.id}><div><strong>SOS #{item.id}</strong><span>{item.address || `${item.latitude}, ${item.longitude}`}</span><small>{date(item.created_at)}</small></div><select aria-label={`Update SOS ${item.id}`} value={item.status} onChange={event => updateSos(item.id, event.target.value)}>{['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'].map(status => <option key={status}>{status}</option>)}</select></article>) : <div className="panel-empty">No SOS records.</div>}</section></div>
  </section>
}

export function AdminSystem() {
  const { data, error, loading, refresh } = useRequest(async () => {
    const [health, settings, audit] = await Promise.all([API.systemHealth(), API.systemSettings(), API.auditLogs()])
    return { health, settings, audit }
  }, [], 30000)
  const [values, setValues] = useState({})
  const [message, setMessage] = useState('')
  useEffect(() => { if (data?.settings) setValues(Object.fromEntries(data.settings.map(item => [item.setting_key, item.setting_value]))) }, [data])
  async function save(key) {
    try { await API.updateSystemSettings({ [key]: values[key] }); setMessage(`${key} saved.`); await refresh() }
    catch (saveError) { setMessage(saveError.message) }
  }
  const healthItems = data?.health ? [['Backend API', data.health.api], ['Database', data.health.database], ['Incident classification', data.health.classification], ['Model', data.health.model || 'Rule-based fallback']] : []
  return <section className="command-page"><CommandHeading eyebrow="Platform operations" title="System" subtitle="Health checks, editable backend settings, and recent audit activity." action={<button className="command-outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>} />
    {(error || message) && <div className="inline-message" role="status">{error || message}</div>}
    <div className="system-health-grid">{loading && !data ? <div className="panel-empty">Checking system status…</div> : healthItems.map(([label, value]) => <div className="health-row" key={label}><span className={String(value).toLowerCase() === 'error' ? 'health-error-dot' : 'health-dot'} /><div><strong>{label}</strong><span>{value}</span></div></div>)}</div>
    <div className="system-columns"><section className="command-panel"><header><h2>Configuration</h2><span>Stored by backend</span></header>{data?.settings?.length ? data.settings.map(setting => <div className="setting-row" key={setting.setting_key}><div><strong>{setting.setting_key.replaceAll('_', ' ')}</strong><small>{setting.description}</small></div><div className="setting-control">{setting.setting_key === 'alert_sensitivity' ? <select value={values[setting.setting_key] ?? setting.setting_value} onChange={event => setValues({ ...values, [setting.setting_key]: event.target.value })}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value}>{value}</option>)}</select> : <input type="number" value={values[setting.setting_key] ?? setting.setting_value} onChange={event => setValues({ ...values, [setting.setting_key]: event.target.value })} /> }<button className="command-outline-button" onClick={() => save(setting.setting_key)}>Save</button></div></div>) : <div className="panel-empty">No system settings were returned.</div>}</section>
      <section className="command-panel"><header><h2>Recent audit log</h2><span>Latest 200 records</span></header>{data?.audit?.length ? <div className="audit-list">{data.audit.slice(0, 30).map(item => <div key={item.id}><ShieldCheck size={15} /><span><strong>{item.action}</strong><small>{item.actor_name || 'System'} · {date(item.created_at)}</small></span></div>)}</div> : <div className="panel-empty">No audit entries to display.</div>}</section></div>
    <p className="command-footnote">Mapbox availability depends on the restricted public token configured in the frontend, not this backend health check.</p>
  </section>
}

export function OfficerIncidents() { return <IncidentWorkbench officer /> }

export function OfficerMap() {
  const { data, error, loading } = useRequest(() => API.publicIncidents({ limit: 100 }), [], 30000)
  return <section className="command-page"><CommandHeading eyebrow="District operations" title="Incident map" subtitle="Confirmed incident locations visible to officer roles." />{error && <div className="inline-message" role="alert">{error}</div>}{loading ? <div className="panel-empty">Loading map records…</div> : <div className="officer-map-frame"><CommandMap incidents={data || []} /></div>}</section>
}

export function OfficerAlerts() {
  const { data, error, loading, refresh } = useRequest(() => API.sos(), [], 5000)
  const [message, setMessage] = useState('')
  async function update(item, status) {
    try { await API.updateSOS(item.id, status); await refresh() }
    catch (updateError) { setMessage(updateError.message) }
  }
  return <section className="command-page"><CommandHeading eyebrow="Response operations" title="SOS requests" subtitle="Review the recorded location and update the operational status." action={<button className="command-outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>} />{(error || message) && <div className="inline-message" role="alert">{error || message}</div>}<div className="command-panel">{loading ? <div className="panel-empty">Loading SOS requests…</div> : data?.length ? data.map(item => <article className="sos-command-item" key={item.id}><div><strong>SOS #{item.id}</strong><span>{item.address || `${item.latitude}, ${item.longitude}`}</span><small>{date(item.created_at)}</small></div><select value={item.status} aria-label={`Update SOS ${item.id}`} onChange={event => update(item, event.target.value)}>{['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'].map(status => <option key={status}>{status}</option>)}</select></article>) : <div className="panel-empty">No SOS requests.</div>}</div><p className="command-footnote">Creating an SOS record does not notify emergency services or personal contacts.</p></section>
}

export function OfficerAssignments() {
  const { user } = useAuth()
  const { data, error, loading, refresh } = useRequest(() => user?.role === 'NGO_OFFICER' ? API.ngoDashboard() : Promise.resolve(null), [user?.id, user?.role], 10000)
  if (user?.role !== 'NGO_OFFICER') return <section className="command-page"><CommandHeading eyebrow="Officer workspace" title="Assignments" subtitle="The current backend provides the personal assignment feed for NGO officer accounts only." /><div className="inline-message">Your government officer role does not have an assignment-list endpoint yet. Incident review remains available in the queue.</div><Link className="command-outline-button" to="/officer">Open incident queue</Link></section>
  return <section className="command-page"><CommandHeading eyebrow="Officer workspace" title="My assignments" subtitle="Incidents assigned to your account." action={<button className="command-outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>} />{error && <div className="inline-message" role="alert">{error}</div>}<section className="command-panel"><header><h2>Assigned incidents</h2><span>{data?.assigned_incidents?.length || 0}</span></header>{loading ? <div className="panel-empty">Loading assignments…</div> : data?.assigned_incidents?.length ? <IncidentRows items={data.assigned_incidents} limit={100} /> : <div className="panel-empty">No incidents are assigned to you.</div>}</section><section className="command-panel assignment-sos"><header><h2>Active SOS</h2><span>{data?.active_sos?.length || 0}</span></header>{data?.active_sos?.length ? data.active_sos.map(item => <div className="sos-command-item" key={item.id}><div><strong>SOS #{item.id}</strong><span>{item.address || `${item.latitude}, ${item.longitude}`}</span></div><Link to="/officer/alerts">Open SOS <ExternalLink size={14} /></Link></div>) : <div className="panel-empty">No active SOS records.</div>}</section></section>
}
