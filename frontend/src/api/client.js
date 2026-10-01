const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v1'
const TOKEN_KEY = 'safara_token'
const USER_KEY = 'safara_user'

function getToken() { return localStorage.getItem(TOKEN_KEY) }
function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)) || null } catch { return null } }
function saveSession(data) {
  if (!data?.token || !data?.user) throw new Error('Invalid login response from SAFARA backend.')
  localStorage.setItem(TOKEN_KEY, data.token)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return data.user
}
function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) }

async function request(path, { auth = true, ...options } = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (auth && token) headers.set('Authorization', `Bearer ${token}`)
  const fetchOptions = { ...options, headers }
  if (!options.method || options.method.toUpperCase() === 'GET') fetchOptions.cache = 'no-store'

  let response
  try { response = await fetch(`${BASE_URL}${path}`, fetchOptions) }
  catch { throw new Error(`Cannot reach SAFARA backend at ${BASE_URL}. Start Flask first.`) }

  const raw = await response.text()
  let data = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = null }
  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession()
      window.dispatchEvent(new Event('safara:unauthorized'))
    }
    const fallback = { 400:'Please check the information and try again.', 401:'Your session is invalid or expired.', 403:'You do not have permission for this action.', 404:'SAFARA resource not found.', 429:'Too many requests. Please try again later.', 500:'The SAFARA server could not complete the request.' }
    throw new Error(data?.error || fallback[response.status] || `Request failed (${response.status}).`)
  }
  return data
}

export const API = {
  BASE_URL, getToken, getUser,
  isLoggedIn: () => Boolean(getToken() && getUser()),
  logout: (redirect = true) => { clearSession(); if (redirect) window.location.href = '/login' },

  async login(email, password) { return saveSession(await request('/auth/login', { auth:false, method:'POST', body:JSON.stringify({ email, password }) })) },
  async register(payload) { return saveSession(await request('/auth/register', { auth:false, method:'POST', body:JSON.stringify(payload) })) },
  me: () => request('/auth/me'),
  ngoApply: payload => request('/auth/ngo/apply', { method:'POST', body:JSON.stringify(payload) }),

  incidents: params => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([,v]) => v !== undefined && v !== ''))
    return request(`/incidents${qs.toString() ? `?${qs}` : ''}`).then(r => r.items || [])
  },
  publicIncidents: params => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([,v]) => v !== undefined && v !== ''))
    return request(`/incidents/public${qs.toString() ? `?${qs}` : ''}`).then(r => r.items || [])
  },
  incident: id => request(`/incidents/${id}`),
  createIncident: payload => request('/incidents', { method:'POST', body:JSON.stringify(payload) }),
  classifyIncident: description => request('/incidents/classify', { method:'POST', body:JSON.stringify({ description }) }),
  reviewIncident: (id, payload) => request(`/incidents/${id}/review`, { method:'PATCH', body:JSON.stringify(payload) }),
  correctClassification: (id, payload) => request(`/incidents/${id}/classification`, { method:'PATCH', body:JSON.stringify(payload) }),
  assignIncident: (id, user_id) => request(`/incidents/${id}/assign`, { method:'POST', body:JSON.stringify({ user_id }) }),

  sos: () => request('/sos').then(r => r.items || []),
  createSOS: payload => request('/sos', { method:'POST', body:JSON.stringify(payload) }),
  updateSOS: (id, status) => request(`/sos/${id}`, { method:'PATCH', body:JSON.stringify({ status }) }),
  contacts: () => request('/contacts').then(r => r.items || []),

  saveLocation: payload => request('/locations/current', { method:'PUT', body:JSON.stringify(payload) }),
  currentLocation: () => request('/locations/current').then(r => r.location || null),

  analyticsDashboard: () => request('/analytics/dashboard'),
  analyticsSeverity: () => request('/analytics/severity').then(r => r.items || []),
  analyticsTypes: () => request('/analytics/types').then(r => r.items || []),
  analyticsTrend: days => request(`/analytics/trend?days=${encodeURIComponent(days)}`).then(r => r.items || []),
  analyticsHotspots: () => request('/analytics/hotspots').then(r => r.items || []),

  adminDashboard: () => request('/admin/dashboard'),
  ngoDashboard: () => request('/ngo/dashboard'),
  adminUsers: () => request('/admin/users').then(r => r.items || []),
  adminOfficers: () => request('/admin/officers').then(r => r.items || []),
  adminTrust: () => request('/admin/trust').then(r => r.items || []),
  ngoApplications: () => request('/admin/ngo-applications').then(r => r.items || []),
  auditLogs: () => request('/admin/audit-logs').then(r => r.items || []),
  updateUserStatus: (id, status) => request(`/admin/users/${id}/status`, { method:'PATCH', body:JSON.stringify({ status }) }),
  reviewNgoApplication: (id, status, review_note='') => request(`/admin/ngo-applications/${id}`, { method:'PATCH', body:JSON.stringify({ status, review_note }) }),
  createAlert: payload => request('/admin/alerts', { method:'POST', body:JSON.stringify(payload) }),
  markAlertRead: id => request(`/admin/alerts/${id}/read`, { method:'PATCH' }),
  triggerProtocol: name => request(`/admin/protocols/${name}`, { method:'POST', body:JSON.stringify({}) }),
  createContact: payload => request('/contacts', { method:'POST', body:JSON.stringify(payload) }),
  deleteContact: id => request(`/contacts/${id}`, { method:'DELETE' }),
  systemHealth: () => request('/system/health-details'),
  systemSettings: () => request('/system/settings').then(r => r.items || []),
  updateSystemSettings: payload => request('/system/settings', { method:'PATCH', body:JSON.stringify(payload) })
}
