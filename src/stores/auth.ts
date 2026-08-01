import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/features/auth/api'
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from '@/features/auth/storage'
import type {
  AuthSession,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  TenantOption,
} from '@/features/auth/types'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(readAuthSession())
  const user = ref<AuthUser | null>(session.value)
  const tenants = ref<TenantOption[]>([])
  const isAuthenticated = computed(() => Boolean(session.value?.accessToken))

  function saveSession(nextSession: AuthSession) {
    session.value = nextSession
    user.value = nextSession
    writeAuthSession(nextSession)
  }

  async function login(request: LoginRequest) {
    const nextSession = await authApi.login(request)
    saveSession(nextSession)
    return nextSession
  }

  async function register(request: RegisterRequest) {
    const nextSession = await authApi.register(request)
    saveSession(nextSession)
    return nextSession
  }

  async function refreshCurrentUser() {
    if (!session.value) return null
    const currentUser = await authApi.getCurrentUser()
    user.value = currentUser
    session.value = { ...session.value, ...currentUser }
    writeAuthSession(session.value)
    return currentUser
  }

  async function loadTenants() {
    if (!session.value) return []
    tenants.value = await authApi.getTenants()
    return tenants.value
  }

  async function switchTenant(tenantCode: string) {
    const nextSession = await authApi.switchTenant(tenantCode)
    saveSession(nextSession)
    await loadTenants()
    return nextSession
  }

  function logout() {
    session.value = null
    user.value = null
    tenants.value = []
    clearAuthSession()
  }

  return {
    session,
    user,
    tenants,
    isAuthenticated,
    login,
    register,
    refreshCurrentUser,
    loadTenants,
    switchTenant,
    logout,
  }
})
