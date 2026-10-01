import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homeForRole } from '../utils/helpers'
import { LoadingScreen } from '../components/StatusScreen'

export function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />
  return <Outlet />
}
