export type AgentRecoveryAction =
  | 'RETRY_PROVIDER'
  | 'REPAIR_TOOL_CALL'
  | 'REPAIR_OUTPUT'
  | 'WAIT_FOR_REVIEW'
  | 'CONFIGURATION'
  | 'NONE'

export interface AgentErrorPresentation {
  code: string
  title: string
  description: string
  action: AgentRecoveryAction
  actionLabel: string
}

const catalog: Record<string, Omit<AgentErrorPresentation, 'code'>> = {
  AGENT_OUTPUT_NOT_JSON: {
    title: '模型输出不是合法 JSON',
    description: '系统已尝试按输出契约修复一次；如果仍失败，需要检查输出字段配置或人工处理。',
    action: 'REPAIR_OUTPUT',
    actionLabel: '已执行一次输出修复',
  },
  AGENT_OUTPUT_SCHEMA_INVALID: {
    title: '模型输出不符合输出契约',
    description: '模型返回了 JSON，但字段、类型或必填项不符合当前 Agent 版本的 Schema。',
    action: 'WAIT_FOR_REVIEW',
    actionLabel: '需要检查输出字段配置',
  },
  AGENT_INPUT_NOT_JSON: {
    title: '输入数据不是合法 JSON',
    description: '当前 Agent 配置了输入契约，请检查流程变量映射和输入字段类型。',
    action: 'CONFIGURATION',
    actionLabel: '需要修正输入配置',
  },
  AGENT_INPUT_SCHEMA_INVALID: {
    title: '输入数据不符合输入契约',
    description: '流程传入的数据缺少必填字段，或字段类型与 Agent 输入 Schema 不一致。',
    action: 'CONFIGURATION',
    actionLabel: '需要修正输入映射',
  },
  AGENT_TOOL_CALL_INVALID: {
    title: '工具调用格式无效',
    description: '模型没有生成可执行的工具调用。系统会限制修复次数，避免无限重试。',
    action: 'REPAIR_TOOL_CALL',
    actionLabel: '已执行一次工具调用修复',
  },
  AGENT_RESULT_EMPTY: {
    title: 'Agent 没有产生结果',
    description: '模型调用完成，但没有返回可用内容。请检查提示词、模型配置和结果策略。',
    action: 'WAIT_FOR_REVIEW',
    actionLabel: '需要检查结果策略',
  },
  PROVIDER_UNAVAILABLE: {
    title: '模型 Provider 暂时不可用',
    description: '这是基础设施类临时故障，系统会按照重试预算和退避策略处理。',
    action: 'RETRY_PROVIDER',
    actionLabel: '可按策略重试',
  },
  PROVIDER_TIMEOUT: {
    title: '模型 Provider 请求超时',
    description: '请求超过了当前 Agent 版本的超时时间，系统不会无限重复调用。',
    action: 'RETRY_PROVIDER',
    actionLabel: '可按策略重试',
  },
  AGENT_CONFIGURATION_ERROR: {
    title: 'Agent 配置不可用',
    description: '当前发布版本的 Provider、凭证或执行配置不完整，需要管理员检查配置。',
    action: 'CONFIGURATION',
    actionLabel: '需要管理员处理',
  },
  AGENT_EXECUTION_ERROR: {
    title: 'Agent 执行异常',
    description: '执行过程中出现未分类异常。请保留运行编号和 Trace ID，交由管理员排查。',
    action: 'WAIT_FOR_REVIEW',
    actionLabel: '需要管理员排查',
  },
}

export function getAgentErrorPresentation(code?: string | null): AgentErrorPresentation | null {
  if (!code) return null
  return {
    code,
    ...(catalog[code] || {
      title: 'Agent 执行未完成',
      description: '系统已记录本次失败，但暂时没有匹配到更具体的恢复策略。请联系管理员。',
      action: 'WAIT_FOR_REVIEW',
      actionLabel: '需要管理员处理',
    }),
  }
}
