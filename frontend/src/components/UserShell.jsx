import { NavLink, Outlet } from 'react-router-dom'
import { Compass, FileText, Home, LogOut, MapPinned, Phone, Settings, Siren, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../utils/helpers'

const mainNav = [
  { to: '/app', end: true, label: 'Home', icon: Home },
  { to: '/app/explore', label: 'Explore', icon: Compass },
  { to: '/app/reports', label: 'My Reports', icon: FileText },
  { to: '/app/sos', label: 'SOS', icon: Siren },
  { to: '/app/contacts', label: 'Emergency Contacts', icon: Phone }
]

const mobileNav = [
  { to: '/app', end: true, label: 'Home', icon: Home },
  { to: '/app/explore', label: 'Explore', icon: MapPinned },
  { to: '/app/reports', label: 'Reports', icon: FileText },
  { to: '/app/sos', label: 'SOS', icon: Siren },
  { to: '/app/profile', label: 'Profile', icon: UserRound }
]

export function UserShell() {
  const { user, logout } = useAuth()
  const first = user?.name?.split(' ')[0] || 'there'

  return (
    <div className="user-shell">
      <aside className="user-sidebar">
        <div className="brand-row">
          <div className="brand-mark">S</div>
          <div className="brand-name">SAFARA</div>
        </div>
        <nav className="nav-list">
          {mainNav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <item.icon strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-foot">
          <NavLink to="/app/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Settings strokeWidth={2} />
            Settings
          </NavLink>
          <button type="button" className="nav-link" onClick={logout} style={{ width: '100%', background: 'none', border: 0 }}>
            <LogOut strokeWidth={2} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="user-main">
        <header className="user-header">
          <div>
            <strong>{first}</strong>
            <div className="muted">{roleLabel[user?.role] || 'Resident'}</div>
          </div>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </header>
        <div className="user-content">
          <Outlet />
        </div>
      </div>
      <nav className="user-tabbar">
        {mobileNav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'active' : ''}>
            <item.icon size={18} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
