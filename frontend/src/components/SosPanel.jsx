import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, MapPin, Phone, ShieldCheck, Siren } from 'lucide-react'
import { API } from '../api/client'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

export default function SosPanel() {
  const [alerts, setAlerts] = useState([])
  const [busy, setBusy] = useState(false)
  const [holding, setHolding] = useState(false)
  const [message, setMessage] = useState('')
  const timer = useRef(null)
  const activeAlert = alerts.find(alert => alert.status === 'ACTIVE')

  async function refreshAlerts() {
    try { setAlerts(await API.sos()) }
    catch (error) { setMessage(error.message) }
  }
  useEffect(() => { refreshAlerts(); return () => window.clearTimeout(timer.current) }, [])
  useAutoRefresh(refreshAlerts, 5000)

  function cancelHold() {
    window.clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }

  function beginHold() {
    if (busy || activeAlert) return
    setHolding(true)
    setMessage('')
    timer.current = window.setTimeout(async () => {
      setHolding(false)
      setBusy(true)
      if (!navigator.geolocation) { setMessage('This browser does not provide location access.'); setBusy(false); return }
      navigator.geolocation.getCurrentPosition(async position => {
        try {
          const result = await API.createSOS({ latitude: position.coords.latitude, longitude: position.coords.longitude, message: 'SOS alert from SAFARA' })
          setAlerts(items => [{ id: result.id, status: result.status, latitude: position.coords.latitude, longitude: position.coords.longitude, created_at: new Date().toISOString() }, ...items])
          setMessage('SOS recorded. SAFARA has not notified your contacts or emergency services.')
        } catch (error) { setMessage(error.message) }
        finally { setBusy(false) }
      }, () => { setMessage('Allow location access to record an SOS.'); setBusy(false) }, { enableHighAccuracy: true, timeout: 12000 })
    }, 3000)
  }

  async function cancelAlert() {
    if (!activeAlert) return
    setBusy(true)
    try {
      await API.updateSOS(activeAlert.id, 'CANCELLED')
      setAlerts(items => items.map(alert => alert.id === activeAlert.id ? { ...alert, status: 'CANCELLED' } : alert))
      setMessage('Your active SOS was cancelled.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return <section className="sos-page">
    <div className="page-heading"><span className="eyebrow">Emergency</span><h1>Need immediate help?</h1><p>SAFARA records your location for operational review. It does not contact emergency services.</p></div>
    <div className={`sos-control${activeAlert ? ' sos-active' : ''}`}>
      <div className="sos-control-icon"><Siren size={24} /></div>
      <h2>{activeAlert ? 'SOS is active' : 'Send an SOS'}</h2>
      {activeAlert ? <><p>Recorded at {new Date(activeAlert.created_at).toLocaleString()}</p>{Number.isFinite(Number(activeAlert.latitude)) && <p>Location recorded: {Number(activeAlert.latitude).toFixed(4)}, {Number(activeAlert.longitude).toFixed(4)}</p>}<div className="sos-status"><span /> Awaiting response</div><button className="button-danger" type="button" disabled={busy} onClick={cancelAlert}>Cancel SOS</button></> : <><p>Press and hold for 3 seconds to record your current location.</p><button type="button" className={`sos-hold-button${holding ? ' holding' : ''}`} disabled={busy} onPointerDown={beginHold} onPointerUp={cancelHold} onPointerLeave={cancelHold} onPointerCancel={cancelHold} onKeyDown={event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); beginHold() } }} onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') cancelHold() }} onBlur={cancelHold} onContextMenu={event => event.preventDefault()} aria-label="Press and hold for 3 seconds to activate SOS"><span>{busy ? 'Recording…' : 'SOS'}</span><small>{holding ? 'KEEP HOLDING' : 'HOLD 3 SEC'}</small></button><div className="sos-disclaimer"><AlertTriangle size={15} /> No contacts or emergency services are notified.</div></>}
    </div>
    {message && <div className="inline-message" role="status">{message}</div>}
    <Link className="text-link sos-contact-link" to="/app/contacts">Manage emergency contacts</Link>
    <div className="sos-help-grid"><div><ShieldCheck size={18} /><span><strong>Location required</strong><small>GPS permission is requested only when activating SOS.</small></span></div><div><Phone size={18} /><span><strong>Need emergency services?</strong><small>Call your local emergency number directly.</small></span></div><div><MapPin size={18} /><span><strong>Previously recorded alerts</strong><small>Your active and cancelled alerts appear here after loading.</small></span></div></div>
    {alerts.length > 0 && <div className="sos-history"><h2>Recent SOS records</h2>{alerts.slice(0, 5).map(alert => <div className="sos-history-row" key={alert.id}><span>#{alert.id}</span><strong>{String(alert.status).replaceAll('_', ' ')}</strong><small>{alert.created_at ? new Date(alert.created_at).toLocaleString() : ''}</small></div>)}</div>}
  </section>
}