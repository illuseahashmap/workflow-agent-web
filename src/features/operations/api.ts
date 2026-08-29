import { apiClient } from '@/api/http'
import type { PageResult } from '@/types/api'

export interface WorkflowAuditEvent {
  id: number
  eventType: string
  tenantCode: string
  actorType: string
  actorId: string
  actorUsername: string
  processInstanceId: string
  processDefinitionKey: string
  taskId: string
  subject: string
  previousState: string
  nextState: string
  reason: string
  traceId: string
  occurredAt: string
}

export interface WorkflowAuditQuery {
  pageNum: number
  pageSize: number
  eventType?: string
  processInstanceId?: string
  traceId?: string
}

export const operationsApi = {
  audit: (params: WorkflowAuditQuery) =>
    apiClient.get<PageResult<WorkflowAuditEvent>>('/workflow/management/audit/operations', {
      params,
    }),
}
