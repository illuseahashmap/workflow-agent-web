import { http } from '@/api/http'
import type { PermissionItem, SaveRoleCommand, TenantMember, TenantRole } from './types'

const ROOT = '/auth/access'

export const accessApi = {
  members: (keyword?: string) =>
    http.get<never, TenantMember[]>(`${ROOT}/members`, { params: { keyword } }),
  addMember: (username: string, roleCodes: string[]) =>
    http.post<never, TenantMember>(`${ROOT}/members`, { username, roleCodes }),
  updateMemberRoles: (userId: string, roleCodes: string[]) =>
    http.post<never, void>(`${ROOT}/members/${userId}/roles`, { roleCodes }),
  updateMemberEnabled: (userId: string, enabled: boolean) =>
    http.post<never, void>(`${ROOT}/members/${userId}/enabled`, undefined, {
      params: { enabled },
    }),
  roles: () => http.get<never, TenantRole[]>(`${ROOT}/roles`),
  saveRole: (payload: SaveRoleCommand) => http.post<never, TenantRole>(`${ROOT}/roles`, payload),
  permissions: () => http.get<never, PermissionItem[]>(`${ROOT}/permissions`),
}
