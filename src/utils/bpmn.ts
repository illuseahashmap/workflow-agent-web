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
  return document
}

export type BpmnTaskMode = 'single' | 'candidate' | 'parallel'

export function resolveTaskMode(xml: string, taskDefinitionKey: string): BpmnTaskMode | undefined {
  const document = validateBpmnXml(xml)
  const task = Array.from(document.getElementsByTagName('*')).find(
    (element) =>
      element.localName === 'userTask' && element.getAttribute('id') === taskDefinitionKey,
  )
  if (!task) return undefined
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
