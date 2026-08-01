import axios, { AxiosError } from 'axios'
import type { ApiResponse } from '@/types/api'
import { clearAuthSession, getAccessToken } from '@/features/auth/storage'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code = 'REQUEST_FAILED',
    public readonly status?: number,
    public readonly traceId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const accessToken = getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code !== 'SUCCESS') {
        throw new ApiError(body.message || '操作失败', body.code, response.status)
      }
      return body.data as typeof response
    }
    return body as typeof response
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    const body = error.response?.data
    const traceId = error.response?.headers['x-trace-id'] as string | undefined
    if (error.response?.status === 401) {
      clearAuthSession()
      window.dispatchEvent(new CustomEvent('workflow-auth:unauthorized'))
    }
    const message =
      body?.message ||
      (error.response?.status === 401
        ? '登录状态已失效'
        : error.response?.status === 403
          ? '没有权限执行此操作'
          : error.message || '网络请求失败')
    return Promise.reject(
      new ApiError(message, body?.code || 'HTTP_ERROR', error.response?.status, traceId),
    )
  },
)

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败'
}
