import { http } from '@/api/http'
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
    http.get<never, PageResult<ProcessInstanceSummary>>(`${ROOT}/instances/page`, { params }),
  detail: (processInstanceId: string) =>
    http.get<never, ProcessInstanceDetail>(`${ROOT}/instance/detail`, {
      params: { processInstanceId },
    }),
  diagram: (processInstanceId: string) =>
    http.get<never, ProcessDiagramData>(`${ROOT}/diagram-data`, {
      params: { processInstanceId },
    }),
  terminate: (processInstanceId: string, reason: string) =>
    http.post<never, void>(`${ROOT}/instance/terminate`, { processInstanceId, reason }),
  transfer: (payload: {
    taskId: string
    currentAssignee: string
    currentCandidateGroups: string[]
    targetAssignee?: string
    targetCandidateUsers: string[]
    targetCandidateGroups: string[]
    comment?: string
  }) => http.post<never, void>('/workflow/task/transfer', payload),
}
