import { describe, expect, it } from 'vitest'
import { normalizeProcessIdentity } from '@/features/process-definition/domain'

describe('process definition identity', () => {
  it('normalizes a valid identity', () => {
    expect(normalizeProcessIdentity(' expense_approval ', ' 费用审批 ')).toEqual({
      key: 'expense_approval',
      name: '费用审批',
    })
  })

  it.each(['1approval', 'approval space', '_approval'])('rejects invalid key %s', (key) => {
    expect(() => normalizeProcessIdentity(key, '审批')).toThrow('流程标识应以字母开头')
  })
})
