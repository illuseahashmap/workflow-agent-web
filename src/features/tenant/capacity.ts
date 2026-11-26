import { apiClient } from '@/api/http'

import type { CapacityLimits, CapacityOverrides, CapacityView } from './capacity-contract.generated'
export type { CapacityLimits, CapacityOverrides, CapacityView } from './capacity-contract.generated'

export const capacityFields = [
  {
    key: 'outstanding',
    label: '未完成任务',
    description: '包含排队、运行及暂停的任务，适用于所有执行后端。',
  },
  {
    key: 'active',
    label: '同时运行任务',
    description: '图执行器正在处理的任务数，挂起等待时不占用。',
  },
  {
    key: 'calls',
    label: '同时外部调用',
    description: '图执行的模型和工具调用；结果尚未确认的调用仍占额度。',
  },
] as const
export function capacityError(
  values: CapacityOverrides,
  ceiling: CapacityLimits,
  inherit: boolean,
) {
  for (const field of capacityFields) {
    const value = values[field.key]
    if (value === null && inherit) continue
    if (value === null || !Number.isSafeInteger(value) || value < 1 || value > ceiling[field.key])
      return `${field.label}必须为 1 至 ${ceiling[field.key]} 的整数`
  }
  return ''
}
const ROOT = '/agent-runtime/capacity'
export const capacityApi = {
  read: (tenantCode?: string) =>
    apiClient.get<CapacityView>(
      tenantCode ? `${ROOT}/tenants/${encodeURIComponent(tenantCode)}` : ROOT,
    ),
  updatePlatform: (revision: number, platform: CapacityLimits, defaults: CapacityLimits) =>
    apiClient.put<CapacityView>(ROOT, { revision, platform, defaults }),
  updateTenant: (tenantCode: string, revision: number, overrides: CapacityOverrides) =>
    apiClient.put<CapacityView>(`${ROOT}/tenants/${encodeURIComponent(tenantCode)}`, {
      revision,
      overrides,
    }),
}
