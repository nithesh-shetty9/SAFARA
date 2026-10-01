import { NavLink, Outlet } from 'react-router-dom'
import { Bell, ClipboardList, LayoutDashboard, LogOut, Map, ShieldAlert, ShieldCheck, Settings, Users, BarChart3 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../utils/helpers'

const adminNav = [
  { to: '/admin', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/incidents', label: 'Incidents', icon: ClipboardList },
  { to: '/admin/officers', label: 'Officers', icon: Users },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/trust', label: 'Trust', icon: ShieldCheck },
  { to: '/admin/alerts', label: 'Alerts', icon: Bell },
  { to: '/admin/system', label: 'System', icon: Settings }
]

const officerNav = [
  { to: '/officer', end: true, label: 'Incidents', icon: ClipboardList },
  { to: '/officer/map', label: 'Map', icon: Map },
  { to: '/officer/alerts', label: 'SOS / Alerts', icon: ShieldAlert },
  { to: '/officer/assignments', label: 'Assignments', icon: Users }
]

export function CommandShell({ variant = 'admin' }) {
  const { user, logout } = useAuth()
  const admin = variant === 'admin'
  const nav = admin ? adminNav : officerNav
  const consoleLabel = admin ? 'Admin Console' : 'Officer Console'

  return (
    <div className="cmd-shell">
      <aside className={`cmd-sidebar${admin ? ' cmd-sidebar-expanded' : ''}`} aria-label={consoleLabel}>
        <div className="cmd-brand"><div className="brand-mark" title="SAFARA">S</div>{admin && <div><strong>SAFARA</strong><span>District Command Center</span></div>}</div>
        {admin && <div className="cmd-sidebar-location">Mangaluru District · Karnataka</div>}
        <nav className="cmd-nav">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) => `cmd-link${admin ? ' cmd-label-link' : ''}${isActive ? ' active' : ''}`}
            >
              <item.icon size={20} strokeWidth={2} />
              {admin && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button type="button" className={`cmd-link${admin ? ' cmd-label-link' : ''}`} onClick={logout} title="Sign out" aria-label="Sign out" style={{ background: 'none', border: 0, width: '100%' }}>
          <LogOut size={20} />
          {admin && <span>Sign out</span>}
        </button>
      </aside>
      <div className="cmd-body">
        <header className="cmd-header">
          <div>
            <div className="cmd-header-title"><span className="cmd-dot" />{consoleLabel.toUpperCase()}</div>
            <div className="cmd-header-sub">Mangaluru District · Karnataka</div>
          </div>
          <div className="cmd-header-sub">{user?.name} · {roleLabel[user?.role] || user?.role}</div>
        </header>
        <div className="cmd-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
