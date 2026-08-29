export type ToolConnectorStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED'
export type ToolVersionStatus = 'DRAFT' | 'PUBLISHED' | 'DISABLED'
export type ToolCatalogStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED'

export interface ToolConnectorSummary {
  connectorId: number
  connectorCode: string
  connectorName: string
  connectorStatus: ToolConnectorStatus
  connectorVersionId: number
  connectorVersion: number
  endpointUrl: string
  protocolVersion: string
  connectorVersionStatus: ToolVersionStatus
  latestCatalogVersionId?: number
  latestCatalogStatus?: ToolCatalogStatus
  toolCount: number
}

export interface ToolConnectorCommand {
  connectorCode: string
  connectorName: string
  endpointUrl: string
  protocolVersion?: string
  credentialRef?: string
  timeoutSeconds?: number
}

export interface ToolDiscovery {
  catalogVersionId: number
  status: ToolCatalogStatus
  fingerprint: string
  tools: ToolSnapshot[]
}

export interface ToolSnapshot {
  snapshotId: number
  registryToolCode: string
  name: string
  description?: string
  inputSchema: string
}
