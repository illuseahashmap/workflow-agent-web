import { describe, expect, it } from 'vitest'
import { createBlankBpmn, resolveTaskMode, validateBpmnXml } from '@/utils/bpmn'

describe('BPMN utilities', () => {
  it('creates an executable plain XML process', () => {
    const xml = createBlankBpmn('expense_approval', '费用审批')
    const document = validateBpmnXml(xml)
    const process = Array.from(document.getElementsByTagName('*')).find(
      (element) => element.localName === 'process',
    )

    expect(process?.getAttribute('id')).toBe('expense_approval')
    expect(process?.getAttribute('name')).toBe('费用审批')
    expect(xml).not.toContain('BASE64')
  })

  it('rejects malformed BPMN XML', () => {
    expect(() => validateBpmnXml('<definitions>')).toThrow('BPMN XML 格式错误')
  })

  it.each([
    ['singleTask', 'single'],
    ['candidateTask', 'candidate'],
    ['parallelTask', 'parallel'],
  ] as const)('resolves %s mode as %s', (taskId, expected) => {
    const xml = `<?xml version="1.0"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:flowable="http://flowable.org/bpmn">
        <process id="approval" isExecutable="true">
          <userTask id="singleTask" flowable:assignee="demo" />
          <userTask id="candidateTask" flowable:candidateUsers="demo" />
          <userTask id="parallelTask"><multiInstanceLoopCharacteristics /></userTask>
        </process>
      </definitions>`

    expect(resolveTaskMode(xml, taskId)).toBe(expected)
  })
})
