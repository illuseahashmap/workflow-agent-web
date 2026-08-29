import { apiClient } from '@/api/http'
import type {
  ToolConnectorCommand,
  ToolConnectorSummary,
  ToolDiscovery,
  ToolSnapshot,
} from './types'

export const toolApi = {
  list: () => apiClient.get<ToolConnectorSummary[]>('/mcp/connectors'),
  createConnector: (payload: ToolConnectorCommand) =>
    apiClient.post<{ id: number; connectorId: number; version: number }>(
      '/mcp/connectors',
      payload,
    ),
  deleteDraftConnector: (connectorId: number) =>
    apiClient.delete<void>(`/mcp/connectors/${connectorId}`),
  discover: (connectorVersionId: number) =>
    apiClient.post<ToolDiscovery>(`/mcp/connector-versions/${connectorVersionId}/discover`),
  publish: (catalogVersionId: number) =>
    apiClient.post<void>(`/mcp/catalog-versions/${catalogVersionId}/publish`),
  publishedTools: (catalogVersionId: number) =>
    apiClient.get<ToolSnapshot[]>(`/mcp/catalog-versions/${catalogVersionId}/tools`),
  bindToAgentVersion: (agentVersionId: number, toolSnapshotId: number) =>
    apiClient.post<void>(`/mcp/agent-versions/${agentVersionId}/tools/${toolSnapshotId}`),
  unbindFromAgentVersion: (agentVersionId: number, toolSnapshotId: number) =>
    apiClient.delete<void>(`/mcp/agent-versions/${agentVersionId}/tools/${toolSnapshotId}`),
}
