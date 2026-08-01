import { http } from '@/api/http'
import type { PageResult } from '@/types/api'
import type {
  ActiveProcessVersion,
  DefinitionPageQuery,
  DeployProcessResult,
  ProcessDefinition,
  ProcessDefinitionSummary,
} from './types'

const ROOT = '/workflow/management/process'

export const definitionApi = {
  page: (params: DefinitionPageQuery) =>
    http.get<never, PageResult<ProcessDefinitionSummary>>(`${ROOT}/definitions/page`, { params }),
  listProcesses: () =>
    http.get<never, ProcessDefinition[]>(`${ROOT}/definitions`),
  listVersions: (processDefinitionKey: string) =>
    http.get<never, ProcessDefinition[]>(`${ROOT}/definitions`, {
      params: { processDefinitionKey },
    }),
  detail: (processDefinitionKey: string, version?: number) =>
    http.get<never, ProcessDefinition>(`${ROOT}/definition`, {
      params: { processDefinitionKey, version },
    }),
  exists: (processDefinitionKey: string) =>
    http.get<never, boolean>(`${ROOT}/definition/exists`, { params: { processDefinitionKey } }),
  deploy: (payload: {
    processDefinitionKey: string
    processDefinitionName: string
    bpmnXml: string
  }) => http.post<never, DeployProcessResult>(`${ROOT}/deploy`, payload),
  activate: (payload: { processDefinitionKey: string; version: number }) =>
    http.post<never, ActiveProcessVersion>(`${ROOT}/definition/activate`, payload),
  active: (processDefinitionKey: string) =>
    http.get<never, ActiveProcessVersion>(`${ROOT}/definition/active`, {
      params: { processDefinitionKey },
    }),
  deleteAll: (processDefinitionKey: string) =>
    http.delete<never, void>(`${ROOT}/definition`, { params: { processDefinitionKey } }),
  deleteVersion: (processDefinitionKey: string, version: number) =>
    http.delete<never, void>(`${ROOT}/definition/version`, {
      params: { processDefinitionKey, version },
    }),
}
