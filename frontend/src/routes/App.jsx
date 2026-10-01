import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuth } from '../context/AuthContext'
import { homeForRole, ADMIN_ROLES, OFFICER_ROLES } from '../utils/helpers'
import { Login, Signup, NgoRegister } from '../pages/AuthPages'
import { UserShell } from '../components/UserShell'
import { CommandShell } from '../components/CommandShell'
import { ErrorScreen, LoadingScreen } from '../components/StatusScreen'
import { UserHome, UserExplore, UserReports, UserReportCreate, UserSos, UserContacts, UserProfile } from '../pages/UserPages'
import {
  AdminOverview, AdminIncidents, AdminOfficers, AdminAnalytics, AdminTrust, AdminAlerts, AdminSystem,
  OfficerIncidents, OfficerMap, OfficerAlerts, OfficerAssignments
} from '../pages/CommandPages'

function GuestRoute() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to={homeForRole(user.role)} replace />
  return <Outlet />
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeForRole(user.role)} replace />
}

function NotFound() {
  const { user } = useAuth()
  return (
    <ErrorScreen
      title="Page not found"
      message="That SAFARA screen does not exist."
      action={<a href={user ? homeForRole(user.role) : '/login'} className="btn-primary" style={{ display: 'inline-block', marginTop: 16, maxWidth: 200 }}>Go back</a>}
    />
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Route>
      <Route element={<ProtectedRoute roles={['USER']} />}>
        <Route path="/app" element={<UserShell />}>
          <Route index element={<UserHome />} />
          <Route path="explore" element={<UserExplore />} />
          <Route path="reports" element={<UserReports />} />
          <Route path="report" element={<UserReportCreate />} />
          <Route path="sos" element={<UserSos />} />
          <Route path="contacts" element={<UserContacts />} />
          <Route path="profile" element={<UserProfile />} />
        </Route>
        <Route path="/ngo-register" element={<NgoRegister />} />
      </Route>
      <Route element={<ProtectedRoute roles={OFFICER_ROLES} />}>
        <Route path="/officer" element={<CommandShell variant="officer" />}>
          <Route index element={<OfficerIncidents />} />
          <Route path="map" element={<OfficerMap />} />
          <Route path="alerts" element={<OfficerAlerts />} />
          <Route path="assignments" element={<OfficerAssignments />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={ADMIN_ROLES} />}>
        <Route path="/admin" element={<CommandShell variant="admin" />}>
          <Route index element={<AdminOverview />} />
          <Route path="incidents" element={<AdminIncidents />} />
          <Route path="officers" element={<AdminOfficers />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="trust" element={<AdminTrust />} />
          <Route path="alerts" element={<AdminAlerts />} />
          <Route path="system" element={<AdminSystem />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
