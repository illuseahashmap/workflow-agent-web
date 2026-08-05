export interface ProcessIdentity {
  key: string
  name: string
}

const PROCESS_DEFINITION_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

export function normalizeProcessIdentity(key: string, name: string): ProcessIdentity {
  const normalizedKey = key.trim()
  const normalizedName = name.trim()
  if (!normalizedKey || !normalizedName) throw new Error('流程标识和流程名称不能为空')
  if (!PROCESS_DEFINITION_KEY_PATTERN.test(normalizedKey)) {
    throw new Error('流程标识应以字母开头，只能包含字母、数字、下划线和短横线')
  }
  return { key: normalizedKey, name: normalizedName }
}
