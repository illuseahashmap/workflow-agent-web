import { http } from '@/api/http'
import type { PageResult } from '@/types/api'
import type {
  AssignmentRule,
  AssignmentRuleCommand,
  AssignmentRuleInheritResult,
  AssignmentType,
  EmptyUserStrategy,
} from './types'

const ROOT = '/workflow/node-assignment-rule'

export interface AssignmentRuleQuery {
  pageNum: number
  pageSize: number
  processDefinitionKey?: string
  processDefinitionId?: string
  version?: number
  taskDefinitionKey?: string
  variableName?: string
  assignmentType?: AssignmentType
  emptyUserStrategy?: EmptyUserStrategy
}

export const assignmentRuleApi = {
  page: (params: AssignmentRuleQuery) =>
    http.get<never, PageResult<AssignmentRule>>(ROOT, { params }),
  create: (payload: AssignmentRuleCommand) => http.post<never, AssignmentRule>(ROOT, payload),
  update: (id: number, payload: AssignmentRuleCommand) =>
    http.post<never, void>(`${ROOT}/${id}`, payload),
  delete: (id: number) => http.delete<never, void>(`${ROOT}/${id}`),
  inherit: (processDefinitionId: string) =>
    http.post<never, AssignmentRuleInheritResult>(`${ROOT}/inherit`, { processDefinitionId }),
}
