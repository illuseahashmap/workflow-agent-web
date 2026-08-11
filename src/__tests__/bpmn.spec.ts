import { describe, expect, it } from 'vitest'
import { createBlankBpmn, listUserTasks, resolveTaskMode, validateBpmnXml } from '@/utils/bpmn'

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

  it('lists user tasks with stable labels and assignment modes', () => {
    const xml = `<?xml version="1.0"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:flowable="http://flowable.org/bpmn">
        <process id="approval" isExecutable="true">
          <userTask id="submitTask" name="提交申请" flowable:assignee="demo" />
          <userTask id="approveTask" name="部门审批" flowable:candidateUsers="manager" />
          <userTask id="archiveTask"><multiInstanceLoopCharacteristics /></userTask>
        </process>
      </definitions>`

    expect(listUserTasks(xml)).toEqual([
      { id: 'submitTask', name: '提交申请', mode: 'single' },
      { id: 'approveTask', name: '部门审批', mode: 'candidate' },
      { id: 'archiveTask', name: 'archiveTask', mode: 'parallel' },
    ])
  })

  it('requires Agent bindings to use a receive-task wait state and a published version id', () => {
    const valid = `<?xml version="1.0"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:workflow="http://workflow-agent.local/bpmn">
        <process id="agent" isExecutable="true">
          <receiveTask id="agentTask"><extensionElements>
            <workflow:agentTask agentVersionId="12" />
          </extensionElements></receiveTask>
        </process>
      </definitions>`
    expect(() => validateBpmnXml(valid)).not.toThrow()

    const invalid = valid.replace(/receiveTask/g, 'serviceTask')
    expect(() => validateBpmnXml(invalid)).toThrow('等待型任务')
  })
})
