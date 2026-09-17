import { apiClient } from '@/api/http'
import type { PageResult } from '@/types/api'
import type {
  DocumentUpload,
  DocumentView,
  IndexVersion,
  IngestionJob,
  KnowledgeScopeGrant,
  RetrievalProfile,
} from './types'

export const knowledgeApi = {
  profiles: (params: { pageNum: number; pageSize: number; keyword?: string; status?: string }) =>
    apiClient.get<PageResult<RetrievalProfile>>('/knowledge/retrieval-profiles', { params }),
  indexVersions: (status = 'ACTIVE') =>
    apiClient.get<IndexVersion[]>('/knowledge/index-versions', { params: { status } }),
  createProfile: (payload: {
    profileCode: string
    strategy: string
    maxResults: number
    minimumScore: number
    indexVersionId: number
    knowledgeScopes: string[]
  }) => apiClient.post<RetrievalProfile>('/knowledge/retrieval-profiles', payload),
  publishProfile: (id: number) =>
    apiClient.post<RetrievalProfile>(`/knowledge/retrieval-profiles/${id}/publish`),
  uploadDocument: (payload: DocumentUpload) =>
    apiClient.post<DocumentView>('/knowledge/documents', payload),
  jobs: (params: { pageNum: number; pageSize: number; status?: string }) =>
    apiClient.get<PageResult<IngestionJob>>('/knowledge/ingestion-jobs', { params }),
  grants: (principalId: string) =>
    apiClient.get<KnowledgeScopeGrant[]>('/knowledge/scope-grants', { params: { principalId } }),
  grant: (payload: { principalId: string; scopeCode: string }) =>
    apiClient.post<void>('/knowledge/scope-grants', payload),
  revoke: (principalId: string, scopeCode: string) =>
    apiClient.delete<void>('/knowledge/scope-grants', { params: { principalId, scopeCode } }),
}
