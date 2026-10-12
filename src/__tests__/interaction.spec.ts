import { describe, expect, it } from 'vitest'
import {
  buildInteractionVariables,
  synchronizeInteractionValues,
} from '@/features/process-instance/interaction'
import type { InteractionDataField } from '@/features/process-instance/types'

function field(dataType: InteractionDataField['dataType']): InteractionDataField {
  return {
    agentActivityId: 'agent-task',
    agentActivityName: '测试 Agent',
    variablePath: 'value',
    agentInputPath: 'value',
    label: '测试值',
    dataType,
    required: false,
  }
}

describe('interaction values', () => {
  it('initializes numeric fields with null for numeric input components', () => {
    expect(synchronizeInteractionValues([field('number')], {})).toEqual({ value: null })
    expect(synchronizeInteractionValues([field('integer')], {})).toEqual({ value: null })
  })

  it('omits untouched optional numeric fields from process variables', () => {
    expect(buildInteractionVariables([field('number')], { value: null })).toEqual({})
  })
})
