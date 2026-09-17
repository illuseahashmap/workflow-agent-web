export interface RetrievalProfile {
  id: number
  profileCode: string
  version: number
  strategy: string
  maxResults: number
  minimumScore: number
  indexVersionId: number
  status: string
  knowledgeScopes: string[]
  createdAt: string
}

export interface IndexVersion {
  id: number
  sourceCode: string
  version: number
  embeddingModel: string
  status: string
  createdAt: string
}

export interface DocumentUpload {
  sourceCode: string
  sourceName?: string
  externalDocumentId: string
  version: number
  contentHash: string
  content: string
}

export interface DocumentView {
  id: number
  sourceCode: string
  externalDocumentId: string
  version: number
  contentHash: string
  status: string
  ingestionJobId: number
  createdAt: string
}

export interface IngestionJob {
  id: number
  sourceCode: string
  documentHash: string
  status: string
  attempt: number
  availableAt: string
  errorCode?: string
  updatedAt: string
}

export interface KnowledgeScopeGrant {
  principalId: string
  scopeCode: string
  createdAt?: string
}
