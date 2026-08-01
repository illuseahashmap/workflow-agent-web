import { http } from '@/api/http'
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from './types'

export function login(request: LoginRequest) {
  return http.post<unknown, AuthSession>('/auth/login', request)
}

export function register(request: RegisterRequest) {
  return http.post<unknown, AuthSession>('/auth/register', request)
}

export function getCurrentUser() {
  return http.get<unknown, AuthUser>('/auth/me')
}
