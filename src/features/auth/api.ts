import { http } from '@/api/http'
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest, TenantOption } from './types'

export function login(request: LoginRequest) {
  return http.post<unknown, AuthSession>('/auth/login', request)
}

export function register(request: RegisterRequest) {
  return http.post<unknown, AuthSession>('/auth/register', request)
}

export function getCurrentUser() {
  return http.get<unknown, AuthUser>('/auth/me')
}

export function getTenants() {
  return http.get<unknown, TenantOption[]>('/auth/tenants')
}

export function switchTenant(tenantCode: string) {
  return http.post<unknown, AuthSession>('/auth/switch-tenant', { tenantCode })
}
