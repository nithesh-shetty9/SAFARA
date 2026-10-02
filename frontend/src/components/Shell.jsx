import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API } from '../api/client'
import { isAdmin, isOfficer } from '../utils/helpers'
import { useToast } from './Toast'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getAccuratePosition } from '../utils/geo'

const pages = { map:'/map', report:'/report', ngo:'/ngo', about:'/about', incidents:'/incidents', gov:'/gov' }

export function Header() {
  const { user, logout } = useAuth(); const toast = useToast(); const [busy,setBusy]=useState(false)
  const navigate = useNavigate()
  async function sos() {
    setBusy(true)
    if (!navigator.geolocation) { toast.show('Location unavailable','Your browser does not provide GPS.','⚠️'); setBusy(false); return }
    getAccuratePosition().then(async p => {
      try { const r=await API.createSOS({latitude:p.coords.latitude,longitude:p.coords.longitude,message:'SOS alert from SAFARA'}); toast.show('SOS sent','Your emergency alert is active.','🚨'); navigate('/ngo') }
      catch(e){toast.show('SOS failed',e.message,'⚠️')}
      finally{setBusy(false)}
    }).catch(()=>{toast.show('Location unavailable','Allow location access to send SOS.','⚠️');setBusy(false)})
  }
  const roleLabel = isAdmin(user?.role) ? 'Government' : isOfficer(user?.role) ? 'Officer' : ''
  return <header className="header">
    <div className="header-brand"><div className="header-mark">S</div><span className="header-name">SAFARA</span></div>
    <div className="header-welcome">Welcome, <strong>{user?.name?.split(' ')[0]}</strong>{roleLabel && <span style={{marginLeft:8,fontSize:'.72rem',padding:'2px 9px',borderRadius:100,background:isAdmin(user.role)?'#fef3c7':'#dbeafe',color:isAdmin(user.role)?'#b45309':'var(--blue)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em'}}>{roleLabel}</span>}</div>
    <div className="header-actions"><button className="header-sos" onClick={sos} disabled={busy}>{busy?'Sending…':'🚨 SOS'}</button><button className="header-logout" onClick={logout}>Sign out</button></div>
  </header>
}

export function Sidebar({ active }) {
  const { user } = useAuth(); const [expanded,setExpanded]=useState(false)
  const nav = isAdmin(user.role) ? [{id:'gov',icon:'🏛',label:'Analytics'},{id:'incidents',icon:'📋',label:'Incidents'},{id:'ngo',icon:'🛡',label:'Emergency'},{id:'about',icon:'ℹ️',label:'About'}]
    : isOfficer(user.role) ? [{id:'incidents',icon:'📊',label:'Incidents'},{id:'ngo',icon:'🛡',label:'Emergency'},{id:'report',icon:'📋',label:'Report'},{id:'about',icon:'ℹ️',label:'About'}]
    : [{id:'map',icon:'🗺',label:'Navigate'},{id:'report',icon:'📋',label:'Report'},{id:'ngo',icon:'🛡',label:'Emergency'},{id:'about',icon:'ℹ️',label:'About'}]
  return <nav className={`sidebar${expanded?' expanded':''}`}><button className="sidebar-toggle" onClick={()=>setExpanded(!expanded)} title="Toggle menu">{expanded?'←':'☰'}</button><div className="sidebar-divider"/>{nav.map(n=><Link key={n.id} to={pages[n.id]} className={`nav-item${active===n.id?' active':''}`} title={n.label}><span>{n.icon}</span><span className="nav-item-label">{n.label}</span></Link>)}</nav>
}
export function AppShell({active,children}) { return <div className="app-shell"><Header/><div className="app-body"><Sidebar active={active}/><main className="main">{children}</main></div></div> }
