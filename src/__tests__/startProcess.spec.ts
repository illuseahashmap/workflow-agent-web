import { describe, expect, it } from 'vitest'
import { buildProcessVariables } from '@/features/process-instance/startProcess'

describe('process start variables', () => {
  it('converts values by their declared type', () => {
    expect(
      buildProcessVariables([
        { name: 'title', type: 'string', value: '请假' },
        { name: 'days', type: 'number', value: '2' },
        { name: 'urgent', type: 'boolean', value: 'true' },
        { name: 'applicant', type: 'json', value: '{"id":1}' },
      ]),
    ).toEqual({ title: '请假', days: 2, urgent: true, applicant: { id: 1 } })
  })

  it('rejects duplicate names and invalid values', () => {
    expect(() =>
      buildProcessVariables([
        { name: 'days', type: 'number', value: '2' },
        { name: 'days', type: 'number', value: '3' },
      ]),
    ).toThrow('业务变量名称重复')
    expect(() => buildProcessVariables([{ name: 'payload', type: 'json', value: '{' }])).toThrow(
      '必须是有效 JSON',
    )
  })

  it('rejects internal participant variable names', () => {
    expect(() =>
      buildProcessVariables([{ name: 'managerApproval_assignee', type: 'string', value: 'alice' }]),
    ).toThrow('参与人设置')
  })
})
