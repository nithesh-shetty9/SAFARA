export const ADMIN_ROLES = ['DISTRICT_ADMIN', 'SUPER_ADMIN']
export const OFFICER_ROLES = ['NGO_OFFICER', 'GOV_OFFICER']
export const COMMAND_ROLES = [...OFFICER_ROLES, ...ADMIN_ROLES]

export const isAdmin = role => ADMIN_ROLES.includes(role)
export const isOfficer = role => OFFICER_ROLES.includes(role)
export const isCommand = role => COMMAND_ROLES.includes(role)

export function homeForRole(role) {
  if (isAdmin(role)) return '/admin'
  if (isOfficer(role)) return '/officer'
  return '/app'
}

export const roleLabel = {
  USER: 'Resident',
  NGO_OFFICER: 'NGO Officer',
  GOV_OFFICER: 'Government Officer',
  DISTRICT_ADMIN: 'District Admin',
  SUPER_ADMIN: 'Super Admin'
}
