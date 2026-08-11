export type AgentProviderType = 'MOCK' | 'OPENAI_COMPATIBLE'
export type AgentVersionStatus = 'DRAFT' | 'PUBLISHED'
export type AgentFailurePolicy = 'FAIL_PROCESS' | 'CONTINUE_EMPTY' | 'MANUAL_REVIEW'
export type AgentRunStatus =
  'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'CANCELLED'
export type AgentResultStatus = 'SUCCESS' | 'EMPTY' | 'PARTIAL' | 'REJECTED' | 'FAILED'

export interface AgentDefinition {
  id: number
  code: string
  name: string
  description?: string
  enabled: boolean
  latestVersion?: number
  publishedVersion?: number
  createdAt?: string
  updatedAt?: string
}

export interface AgentDefinitionCommand {
  code: string
  name: string
  description?: string
  enabled: boolean
}

export interface AgentVersion {
  id: number
  definitionId: number
  version: number
  status: AgentVersionStatus
  providerId?: number
  providerName?: string
  modelName?: string
  systemPrompt: string
  timeoutSeconds: number
  failurePolicy: AgentFailurePolicy
  inputSchema?: string
  outputSchema?: string
  createdBy?: string
  publishedBy?: string
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface AgentVersionCommand {
  providerId?: number
  modelName?: string
  systemPrompt: string
  timeoutSeconds: number
  failurePolicy: AgentFailurePolicy
  inputSchema?: string
  outputSchema?: string
}

export interface AgentProvider {
  id: number
  code: string
  name: string
  type: AgentProviderType
  baseUrl?: string
  defaultModel?: string
  enabled: boolean
  credentialConfigured: boolean
  credentialHint?: string
  createdAt?: string
  updatedAt?: string
}

export interface AgentProviderCommand {
  code: string
  name: string
  type: AgentProviderType
  baseUrl?: string
  defaultModel?: string
  credential?: string
  enabled: boolean
}

export interface AgentRun {
  id: number
  agentCode: string
  agentName: string
  agentVersion: number
  status: AgentRunStatus
  resultStatus?: AgentResultStatus
  processInstanceId?: string
  activityId?: string
  errorCode?: string
  deadlineAt: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AgentRunAttempt {
  id: number
  attemptNo: number
  status: AgentRunStatus
  errorCode?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AgentRunStep {
  id: number
  attemptId: number
  sequenceNo: number
  stepType: string
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED'
  errorCode?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AgentRunCheckpoint {
  id: number
  attemptId: number
  sequenceNo: number
  checkpointType: string
  snapshotJson: string
  createdAt: string
}

export interface AgentRunStateHistory {
  id: number
  attemptId?: number
  oldStatus: AgentRunStatus
  newStatus: AgentRunStatus
  reasonCode: string
  operatorType: 'SYSTEM' | 'WORKER' | 'USER'
  operatorId: string
  traceId: string
  createdAt: string
}

export interface AgentModelInvocation {
  id: number
  attemptId: number
  stepId: number
  providerName: string
  requestedModel: string
  actualModel?: string
  providerRequestId?: string
  finishReason?: string
  status: 'SUCCEEDED' | 'FAILED'
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  latencyMillis?: number
  errorCode?: string
  createdAt: string
  completedAt?: string
}

export interface AgentRunPayload {
  inputSnapshotJson?: string
  outputSnapshotJson?: string
}

export interface AgentManualRunCommand {
  definitionId: number
  input: string
}

export interface AgentRunSubmission {
  runId: number
  status: AgentRunStatus
}

export interface AgentRunDetail {
  run: AgentRun
  payload: AgentRunPayload
  attempts: AgentRunAttempt[]
  steps: AgentRunStep[]
  modelInvocations: AgentModelInvocation[]
  checkpoints: AgentRunCheckpoint[]
  stateHistory: AgentRunStateHistory[]
}
