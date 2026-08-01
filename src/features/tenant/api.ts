import { http } from '@/api/http'
import type { PageResult } from '@/types/api'
import type { TenantCommand, WorkflowTenant } from './types'

const ROOT = '/workflow/tenant'

export const tenantApi = {
  page: (params: { pageNum: number; pageSize: number; keyword?: string; enabled?: boolean }) =>
    http.get<never, PageResult<WorkflowTenant>>(ROOT, { params }),
  enabled: () => http.get<never, WorkflowTenant[]>(`${ROOT}/enabled`),
  create: (payload: TenantCommand) => http.post<never, WorkflowTenant>(ROOT, payload),
  update: (id: number, payload: TenantCommand) => http.post<never, void>(`${ROOT}/${id}`, payload),
  updateEnabled: (id: number, enabled: boolean) =>
    http.post<never, void>(`${ROOT}/${id}/enabled`, undefined, { params: { enabled } }),
}
