import { apiClient } from '@/api/http'
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest, TenantOption } from './types'

export function login(request: LoginRequest) {
  return apiClient.post<AuthSession>('/auth/login', request)
}

export function ensureCsrfToken() {
  return apiClient.get<string>('/auth/csrf')
}

export function register(request: RegisterRequest) {
  return apiClient.post<AuthSession>('/auth/register', request)
}

export function getCurrentUser() {
  return apiClient.get<AuthUser>('/auth/me')
}

export function getTenants() {
  return apiClient.get<TenantOption[]>('/auth/tenants')
}

export function switchTenant(tenantCode: string) {
  return apiClient.post<AuthSession>('/auth/switch-tenant', { tenantCode })
}

export function logout() {
  return apiClient.post<void>('/auth/logout')
}
