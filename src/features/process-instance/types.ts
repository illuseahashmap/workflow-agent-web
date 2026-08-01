export interface ProcessInstanceSummary {
  processInstanceId: string
  processDefinitionId: string
  processDefinitionKey: string
  processDefinitionName: string
  processDefinitionVersion?: number
  latestTaskId?: string
  businessKey?: string
  startUserId?: string
  startTime?: string
  endTime?: string
  lastUpdateTime?: string
  durationInMillis?: number
  deleteReason?: string
  status: string
  tenantId: string
}

export interface TaskItem {
  taskId: string
  taskDefinitionKey: string
  taskName: string
  assignee?: string
  candidateUsers: string[]
  candidateGroups: string[]
  status: string
  deleteReason?: string
  startTime?: string
  endTime?: string
  durationInMillis?: number
}

export interface VariableItem {
  variableId: string
  variableName: string
  variableTypeName: string
  value: unknown
  executionId?: string
  taskId?: string
  createTime?: string
  lastUpdatedTime?: string
  scopeId?: string
  subScopeId?: string
  scopeType?: string
}

export interface ProcessInstanceDetail {
  instance: ProcessInstanceSummary
  tasks: TaskItem[]
  variables: VariableItem[]
}

export interface ActivityDetail {
  activityId: string
  activityName?: string
  activityType: string
  assignee?: string
  candidateUsers: string[]
  candidateGroups: string[]
  startTime?: string
  endTime?: string
  durationInMillis?: number
  comment?: string
}

export interface ProcessDiagramData {
  bpmnXml: string
  completedActivityIds: string[]
  activeActivityIds: string[]
  highlightedFlows: string[]
  activityDetails: Record<string, ActivityDetail>
}
