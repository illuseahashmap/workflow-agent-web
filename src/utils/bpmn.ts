const XML_NAMESPACE = 'http://workflow-agent.local/bpmn'

function escapeXmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function createBlankBpmn(processKey: string, processName: string) {
  const key = escapeXmlAttribute(processKey)
  const name = escapeXmlAttribute(processName)
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:flowable="http://flowable.org/bpmn"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_${key}" targetNamespace="${XML_NAMESPACE}">
  <bpmn:process id="${key}" name="${name}" isExecutable="true" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${key}" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}

export function validateBpmnXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const parserError = document.querySelector('parsererror')
  if (parserError) throw new Error('BPMN XML 格式错误')
  const process = Array.from(document.getElementsByTagName('*')).find(
    (element) => element.localName === 'process',
  )
  if (!process?.getAttribute('id')) throw new Error('BPMN XML 缺少 process id')
  for (const task of Array.from(document.getElementsByTagName('*')).filter(
    (element) => element.localName === 'agentTask',
  )) {
    const owner = task.parentElement?.parentElement
    if (
      task.parentElement?.localName !== 'extensionElements' ||
      owner?.localName !== 'receiveTask'
    ) {
      throw new Error('Agent 任务必须绑定在等待型任务上')
    }
    const version = Number(task.getAttribute('agentVersionId'))
    if (!Number.isInteger(version) || version <= 0) throw new Error('Agent 任务必须选择已发布版本')
  }
  return document
}

export type BpmnTaskMode = 'single' | 'candidate' | 'parallel'

export interface BpmnUserTask {
  id: string
  name: string
  mode: BpmnTaskMode
}

function resolveTaskElementMode(task: Element): BpmnTaskMode {
  const hasMultiInstance = Array.from(task.children).some(
    (element) => element.localName === 'multiInstanceLoopCharacteristics',
  )
  if (hasMultiInstance) return 'parallel'
  if (
    task.getAttributeNS('http://flowable.org/bpmn', 'candidateUsers') ||
    task.getAttributeNS('http://flowable.org/bpmn', 'candidateGroups') ||
    task.getAttribute('flowable:candidateUsers') ||
    task.getAttribute('flowable:candidateGroups')
  ) {
    return 'candidate'
  }
  return 'single'
}

export function listUserTasks(xml: string): BpmnUserTask[] {
  const document = validateBpmnXml(xml)
  return Array.from(document.getElementsByTagName('*'))
    .filter((element) => element.localName === 'userTask' && element.hasAttribute('id'))
    .map((task) => {
      const id = task.getAttribute('id')!
      return {
        id,
        name: task.getAttribute('name')?.trim() || id,
        mode: resolveTaskElementMode(task),
      }
    })
}

export function resolveTaskMode(xml: string, taskDefinitionKey: string): BpmnTaskMode | undefined {
  const document = validateBpmnXml(xml)
  const task = Array.from(document.getElementsByTagName('*')).find(
    (element) =>
      element.localName === 'userTask' && element.getAttribute('id') === taskDefinitionKey,
  )
  if (!task) return undefined
  return resolveTaskElementMode(task)
}

export function isAgentTaskElement(element?: ModdleElementLike) {
  return Boolean(
    element?.extensionElements?.values?.some((value) => value.$type === 'workflow:AgentTask'),
  )
}

export interface StartFrontierKinds {
  hasAgentWait: boolean
  hasUserTask: boolean
}

export function resolveStartFrontierKinds(xml: string): StartFrontierKinds {
  const document = validateBpmnXml(xml)
  const elements = Array.from(document.getElementsByTagName('*'))
  const byId = new Map(
    elements.filter((element) => element.id).map((element) => [element.id, element]),
  )
  const outgoing = new Map<string, string[]>()
  elements
    .filter((element) => element.localName === 'sequenceFlow')
    .forEach((flow) => {
      const source = flow.getAttribute('sourceRef')
      const target = flow.getAttribute('targetRef')
      if (source && target) outgoing.set(source, [...(outgoing.get(source) || []), target])
    })
  const queue = elements
    .filter((element) => element.localName === 'startEvent')
    .flatMap((element) => outgoing.get(element.id) || [])
  const visited = new Set<string>()
  const result: StartFrontierKinds = { hasAgentWait: false, hasUserTask: false }
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const element = byId.get(id)
    if (!element) continue
    if (element.localName === 'userTask') {
      result.hasUserTask = true
      continue
    }
    if (element.localName === 'receiveTask' && isAgentTaskXmlElement(element)) {
      result.hasAgentWait = true
      continue
    }
    queue.push(...(outgoing.get(id) || []))
  }
  return result
}

function isAgentTaskXmlElement(element: Element) {
  return Array.from(element.children).some(
    (child) =>
      child.localName === 'extensionElements' &&
      Array.from(child.children).some((extension) => extension.localName === 'agentTask'),
  )
}

interface ModdleElementLike {
  $type?: string
  extensionElements?: { values?: ModdleElementLike[] }
}
