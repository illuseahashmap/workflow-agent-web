export type ProcessVariableType = 'string' | 'number' | 'boolean' | 'json'

export interface ProcessVariableDraft {
  name: string
  type: ProcessVariableType
  value: string
}

const INTERNAL_PARTICIPANT_SUFFIXES = ['_assignee', '_assigneeList', '_candidateGroupList']

export function buildProcessVariables(rows: ProcessVariableDraft[]) {
  const variables: Record<string, unknown> = {}
  for (const row of rows) {
    const name = row.name.trim()
    if (!name && !row.value.trim()) continue
    if (!name) throw new Error('业务变量名称不能为空')
    if (INTERNAL_PARTICIPANT_SUFFIXES.some((suffix) => name.endsWith(suffix)))
      throw new Error('参与人请通过“参与人设置”选择，无需填写技术变量')
    if (Object.prototype.hasOwnProperty.call(variables, name))
      throw new Error(`业务变量名称重复：${name}`)
    variables[name] = parseVariableValue(row, name)
  }
  return variables
}

function parseVariableValue(row: ProcessVariableDraft, name: string) {
  switch (row.type) {
    case 'number': {
      const value = Number(row.value)
      if (!row.value.trim() || !Number.isFinite(value)) throw new Error(`${name} 必须是有效数字`)
      return value
    }
    case 'boolean':
      return row.value === 'true'
    case 'json':
      try {
        return JSON.parse(row.value) as unknown
      } catch {
        throw new Error(`${name} 必须是有效 JSON`)
      }
    default:
      return row.value
  }
}
