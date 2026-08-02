import { apiClient } from '@/api/http'
import type { PageResult } from '@/types/api'
import type { ProcessDiagramData, ProcessInstanceDetail, ProcessInstanceSummary } from './types'

const ROOT = '/workflow/management/process'

export interface InstancePageQuery {
  pageNum: number
  pageSize: number
  processDefinitionKey?: string
  processDefinitionName?: string
  processInstanceId?: string
  businessKey?: string
  status?: 'all' | 'running' | 'finished'
}

export const processInstanceApi = {
  page: (params: InstancePageQuery) =>
    apiClient.get<PageResult<ProcessInstanceSummary>>(`${ROOT}/instances/page`, { params }),
  detail: (processInstanceId: string) =>
    apiClient.get<ProcessInstanceDetail>(`${ROOT}/instance/detail`, {
      params: { processInstanceId },
    }),
  diagram: (processInstanceId: string) =>
    apiClient.get<ProcessDiagramData>(`${ROOT}/diagram-data`, {
      params: { processInstanceId },
    }),
  terminate: (processInstanceId: string, reason: string) =>
    apiClient.post<void>(`${ROOT}/instance/terminate`, { processInstanceId, reason }),
  transfer: (payload: {
    taskId: string
    currentAssignee: string
    currentCandidateGroups: string[]
    targetAssignee?: string
    targetCandidateUsers: string[]
    targetCandidateGroups: string[]
    comment?: string
  }) => apiClient.post<void>('/workflow/task/transfer', payload),
}
