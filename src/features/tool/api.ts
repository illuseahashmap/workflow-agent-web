import { apiClient } from '@/api/http'
import type { ToolConnectorCommand, ToolConnectorSummary, ToolDiscovery } from './types'

export const toolApi = {
  list: () => apiClient.get<ToolConnectorSummary[]>('/mcp/connectors'),
  createConnector: (payload: ToolConnectorCommand) =>
    apiClient.post<{ id: number; connectorId: number; version: number }>(
      '/mcp/connectors',
      payload,
    ),
  discover: (connectorVersionId: number) =>
    apiClient.post<ToolDiscovery>(`/mcp/connector-versions/${connectorVersionId}/discover`),
  publish: (catalogVersionId: number) =>
    apiClient.post<void>(`/mcp/catalog-versions/${catalogVersionId}/publish`),
}
