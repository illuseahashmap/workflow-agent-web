<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  triggerRef,
  watch,
} from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, CheckCircle2, Copy, Download, FileUp, Plus, Save, Trash2 } from '@lucide/vue'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import { getErrorMessage } from '@/api/http'
import flowableModdle from '@/bpmn/flowableModdle'
import workflowPaletteModule from '@/bpmn/workflowPaletteModule'
import type {
  ApprovalMode,
  BpmnElement,
  BpmnModelerInstance,
  BpmnReplace,
  Canvas,
  ElementRegistry,
  ListenerKind,
  Moddle,
  ModdleElement,
  Modeling,
} from '@/bpmn/modeler-types'
import { assignmentRuleApi } from '@/features/assignment-rule/api'
import { createBlankBpmn, validateBpmnXml } from '@/utils/bpmn'
import { formatDateTime, formatVersion } from '@/utils/format'
import { definitionApi } from '../api'
import type { ActiveProcessVersion, ProcessDefinition } from '../types'

const DEFAULT_ASSIGNEE = '${assigneeService.getAssignee(execution)}'
const DEFAULT_CANDIDATE_USERS = '${assigneeService.getCandidates(execution)}'
const DEFAULT_CANDIDATE_GROUPS = '${assigneeService.getCandidateGroups(execution)}'
const DEFAULT_COUNTERSIGN_COLLECTION = '${assigneeService.getAssigneeList(execution)}'
const HIDDEN_TECHNICAL_ATTRIBUTES = new Set([
  'flowable:assignee',
  'flowable:candidateUsers',
  'flowable:candidateGroups',
  'flowable:collection',
  'flowable:elementVariable',
])
const LISTENER_SECTIONS: Array<{ kind: ListenerKind; label: string; taskOnly?: boolean }> = [
  { kind: 'executionStart', label: '启动监听器' },
  { kind: 'executionEnd', label: '结束监听器' },
  { kind: 'taskCreate', label: '任务创建监听器', taskOnly: true },
  { kind: 'taskComplete', label: '任务完成监听器', taskOnly: true },
]

const route = useRoute()
const router = useRouter()
const canvasElement = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()
const modeler = shallowRef<BpmnModelerInstance>()
const versions = ref<ProcessDefinition[]>([])
const activeVersion = ref<ActiveProcessVersion>()
const selectedVersion = ref<number>()
const loading = ref(false)
const saving = ref(false)
const publishing = ref(false)
const inheriting = ref(false)
const dirty = ref(false)
const importing = ref(false)
const newProcessVisible = ref(false)
const newProcessSaving = ref(false)
const newProcessForm = reactive({ key: '', name: '' })
const processForm = reactive({ key: '', name: '' })
const selectedElement = shallowRef<BpmnElement>()
const elementBeingEdited = shallowRef<BpmnElement>()
let elementEditSequence = 0
const selectedBusinessObject = shallowRef<ModdleElement>()
const elementForm = reactive({ id: '', name: '', documentation: '', conditionExpression: '' })
const approvalMode = ref<ApprovalMode>('')
const listenerForm = reactive({ kind: 'executionStart' as ListenerKind, bean: '' })
const listeners = reactive<Record<ListenerKind, string[]>>({
  executionStart: [],
  executionEnd: [],
  taskCreate: [],
  taskComplete: [],
})

const selectedType = computed(
  () => selectedBusinessObject.value?.$type || selectedElement.value?.type || '',
)
const isTask = computed(() => ['bpmn:Task', 'bpmn:UserTask'].includes(selectedType.value))
const isSequenceFlow = computed(() => selectedType.value === 'bpmn:SequenceFlow')
const isSelectedActive = computed(() => activeVersion.value?.version === selectedVersion.value)
const selectedDefinition = computed(() =>
  versions.value.find((item) => item.version === selectedVersion.value),
)
const elementTypeLabel = computed(() => getElementTypeLabel(selectedType.value))
const selectedSource = computed(() => selectedBusinessObject.value?.sourceRef?.id || '')
const selectedTarget = computed(() => selectedBusinessObject.value?.targetRef?.id || '')
const extensionAttributes = computed(() => {
  const object = selectedBusinessObject.value
  if (!object) return []
  const attributes: Array<{ key: string; value: string }> = []
  Object.entries(object.$attrs || {}).forEach(([key, value]) => {
    if (
      !HIDDEN_TECHNICAL_ATTRIBUTES.has(key) &&
      value !== undefined &&
      value !== null &&
      String(value)
    ) {
      attributes.push({ key, value: String(value) })
    }
  })
  return attributes
})
const availableListenerSections = computed(() =>
  LISTENER_SECTIONS.filter((section) => !section.taskOnly || isTask.value),
)
const listenerRows = computed(() =>
  availableListenerSections.value.flatMap((section) =>
    listeners[section.kind].map((listener, index) => ({
      kind: section.kind,
      label: section.label,
      listener,
      index,
    })),
  ),
)

function service<T>(name: string) {
  return modeler.value?.get(name) as T | undefined
}

function getElementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    'bpmn:StartEvent': '开始事件',
    'bpmn:EndEvent': '结束事件',
    'bpmn:UserTask': '用户任务',
    'bpmn:Task': '任务',
    'bpmn:ServiceTask': '服务任务',
    'bpmn:ExclusiveGateway': '排他网关',
    'bpmn:ParallelGateway': '并行网关',
    'bpmn:InclusiveGateway': '包容网关',
    'bpmn:SequenceFlow': '连线',
    'bpmn:SubProcess': '子流程',
  }
  return labels[type] || type || '-'
}

function readExpression(value?: ModdleElement | string) {
  if (!value) return ''
  return typeof value === 'string' ? value : value.body || value.text || value.expression || ''
}

function normalizeListener(value: string) {
  const trimmed = value.trim()
  const match = trimmed.match(/^\$\{\s*(.*?)\s*\}$/)
  return match?.[1]?.trim() || trimmed
}

function resetSelection(element?: BpmnElement) {
  selectedElement.value = element
  const object = element?.businessObject
  selectedBusinessObject.value = object
  Object.assign(elementForm, {
    id: object?.id || element?.id || '',
    name: object?.name || '',
    documentation:
      object?.documentation?.map((item) => item.text || item.body || '').join('\n') || '',
    conditionExpression: readExpression(object?.conditionExpression),
  })
  approvalMode.value = object?.loopCharacteristics
    ? 'parallel'
    : object?.candidateUsers || object?.candidateGroups
      ? 'candidate'
      : object?.assignee
        ? 'single'
        : ''
  Object.keys(listeners).forEach((key) => (listeners[key as ListenerKind] = []))
  for (const item of object?.extensionElements?.values || []) {
    const value = normalizeListener(
      String(item.delegateExpression || item.expression || item.class || ''),
    )
    if (!value) continue
    if (item.$type === 'flowable:ExecutionListener' && item.event === 'start')
      listeners.executionStart.push(value)
    if (item.$type === 'flowable:ExecutionListener' && item.event === 'end')
      listeners.executionEnd.push(value)
    if (item.$type === 'flowable:TaskListener' && item.event === 'create')
      listeners.taskCreate.push(value)
    if (item.$type === 'flowable:TaskListener' && item.event === 'complete')
      listeners.taskComplete.push(value)
  }
  triggerRef(selectedBusinessObject)
}

function sanitizeAttributes(object?: ModdleElement | string) {
  if (!object || typeof object === 'string' || !object.$attrs) return
  for (const key of Object.keys(object.$attrs)) {
    if (key.startsWith('$') || key.startsWith('flowable:')) delete object.$attrs[key]
  }
}

function hasUserTaskAssignment(object?: ModdleElement) {
  if (!object || object.$type !== 'bpmn:UserTask') return true
  return Boolean(
    object.assignee ||
    object.candidateUsers ||
    object.candidateGroups ||
    object.loopCharacteristics,
  )
}

function ensureDefaultUserTaskAssignment(element?: BpmnElement) {
  const object = element?.businessObject
  const modeling = service<Modeling>('modeling')
  if (!element || !object || object.$type !== 'bpmn:UserTask' || !modeling) return false
  if (hasUserTaskAssignment(object)) return false
  sanitizeAttributes(object)
  modeling.updateModdleProperties(element, object, {
    candidateUsers: DEFAULT_CANDIDATE_USERS,
    candidateGroups: DEFAULT_CANDIDATE_GROUPS,
  })
  return true
}

function ensureAllUserTaskAssignments() {
  service<ElementRegistry>('elementRegistry')
    ?.getAll()
    .forEach((element) => ensureDefaultUserTaskAssignment(element))
}

function ensureUserTaskElement(element?: BpmnElement) {
  const object = element?.businessObject
  if (!element || !object) return undefined
  if (object.$type === 'bpmn:UserTask') return element
  if (object.$type !== 'bpmn:Task') return undefined
  const nextElement = service<BpmnReplace>('bpmnReplace')?.replaceElement(element, {
    type: 'bpmn:UserTask',
  })
  if (!nextElement) return undefined
  service<Modeling>('modeling')?.updateProperties(nextElement, {
    id: object.id,
    name: object.name || '',
  })
  selectedElement.value = nextElement
  return nextElement
}

function sanitizeModel() {
  ensureAllUserTaskAssignments()
  service<ElementRegistry>('elementRegistry')
    ?.getAll()
    .forEach((element) => {
      const object = element.businessObject
      sanitizeAttributes(object)
      sanitizeAttributes(object?.loopCharacteristics)
      sanitizeAttributes(object?.conditionExpression)
      object?.extensionElements?.values?.forEach(sanitizeAttributes)
    })
}

function syncProcessMetadata() {
  const root = service<Canvas>('canvas')?.getRootElement()
  const object = root?.businessObject
  const modeling = service<Modeling>('modeling')
  if (!root || !object || !modeling) return
  modeling.updateModdleProperties(root, object, {
    id: processForm.key.trim(),
    name: processForm.name.trim(),
    isExecutable: true,
  })
}

async function importXml(xml: string, markDirty: boolean) {
  validateBpmnXml(xml)
  if (!modeler.value) return
  importing.value = true
  await modeler.value.importXML(xml)
  await nextTick()
  sanitizeModel()
  service<Canvas>('canvas')?.zoom('fit-viewport', 'auto')
  resetSelection()
  dirty.value = markDirty
  window.setTimeout(() => (importing.value = false), 0)
}

async function loadVersions(key: string, preferredVersion?: number) {
  loading.value = true
  try {
    versions.value = (await definitionApi.listVersions(key)).sort((a, b) => b.version - a.version)
    if (versions.value.length === 0) return
    try {
      activeVersion.value = await definitionApi.active(key)
    } catch {
      activeVersion.value = undefined
    }
    await openVersion(preferredVersion || versions.value[0]!.version)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function openVersion(version: number) {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm('当前修改尚未保存，切换版本会丢失修改。', '切换版本', {
        confirmButtonText: '继续切换',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }
  }
  loading.value = true
  try {
    const detail = await definitionApi.detail(processForm.key, version)
    selectedVersion.value = detail.version
    processForm.key = detail.processDefinitionKey
    processForm.name = detail.processDefinitionName
    await importXml(detail.bpmnXml, false)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function saveVersion() {
  if (!processForm.key.trim() || !processForm.name.trim() || !modeler.value) {
    ElMessage.error('流程标识和流程名称不能为空')
    return
  }
  saving.value = true
  try {
    syncProcessMetadata()
    sanitizeModel()
    const { xml } = await modeler.value.saveXML({ format: true })
    validateBpmnXml(xml)
    const result = await definitionApi.deploy({
      processDefinitionKey: processForm.key.trim(),
      processDefinitionName: processForm.name.trim(),
      bpmnXml: xml,
    })
    dirty.value = false
    selectedVersion.value = result.version
    await loadVersions(result.processDefinitionKey, result.version)
    ElMessage.success(`已保存为 ${formatVersion(result.version)}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function publishVersion() {
  if (!selectedVersion.value) return
  publishing.value = true
  try {
    activeVersion.value = await definitionApi.activate({
      processDefinitionKey: processForm.key,
      version: selectedVersion.value,
    })
    ElMessage.success(`已发布 ${formatVersion(selectedVersion.value)}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    publishing.value = false
  }
}

async function inheritRules() {
  const definition = selectedDefinition.value
  if (!definition) return
  await ElMessageBox.confirm('将从最近有配置的历史版本继承派单规则，是否继续？', '继承派单规则', {
    confirmButtonText: '继承',
    cancelButtonText: '取消',
  })
  inheriting.value = true
  try {
    const result = await assignmentRuleApi.inherit(definition.processDefinitionId)
    const skipped = result.skippedReasons.length
      ? `；跳过：${result.skippedReasons.join('；')}`
      : ''
    ElMessage.success(`已复制 ${result.copiedCount} 条，跳过 ${result.skippedCount} 条${skipped}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    inheriting.value = false
  }
}

async function deleteVersion() {
  if (!selectedVersion.value) return
  const version = selectedVersion.value
  await ElMessageBox.confirm(
    `确认删除 ${processForm.key} ${formatVersion(version)}？`,
    '删除版本',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    },
  )
  try {
    await definitionApi.deleteVersion(processForm.key, version)
    ElMessage.success(`${formatVersion(version)} 已删除`)
    const remainingVersions = await definitionApi.listVersions(processForm.key)
    if (remainingVersions.length === 0) {
      dirty.value = false
      await router.push('/process-definitions')
      return
    }
    versions.value = remainingVersions.sort((a, b) => b.version - a.version)
    await openVersion(versions.value[0]!.version)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}

async function deleteDefinition() {
  if (!processForm.key) return
  await ElMessageBox.confirm(
    `将删除“${processForm.name || processForm.key}”的全部版本、部署数据及关联配置。此操作不可恢复。`,
    '删除流程图',
    { confirmButtonText: '删除流程图', cancelButtonText: '取消', type: 'error' },
  )
  try {
    await definitionApi.deleteAll(processForm.key)
    dirty.value = false
    ElMessage.success(`已删除流程图：${processForm.key}`)
    await router.push('/process-definitions')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}

async function openNewProcessDialog() {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm('当前修改尚未保存，新建流程会丢失这些修改。', '新建流程图', {
        confirmButtonText: '继续新建',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }
  }
  Object.assign(newProcessForm, { key: '', name: '' })
  newProcessVisible.value = true
}

async function createNewProcess() {
  const key = newProcessForm.key.trim()
  const name = newProcessForm.name.trim()
  if (!key || !name) return ElMessage.error('流程定义 ID 和名称不能为空')
  if (!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(key)) {
    return ElMessage.error('流程定义 ID 应以字母开头，只能包含字母、数字、下划线和短横线')
  }
  newProcessSaving.value = true
  try {
    if (await definitionApi.exists(key)) return ElMessage.error(`流程定义 ID 已存在：${key}`)
    processForm.key = key
    processForm.name = name
    versions.value = []
    activeVersion.value = undefined
    selectedVersion.value = undefined
    await importXml(createBlankBpmn(key, name), true)
    newProcessVisible.value = false
    await router.replace({ name: 'process-designer', query: { key, name } })
    ElMessage.success(`已创建空白流程：${name}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    newProcessSaving.value = false
  }
}

interface ElementFormSnapshot {
  id: string
  name: string
  documentation: string
  conditionExpression: string
}

function getElementFormSnapshot(): ElementFormSnapshot {
  return { ...elementForm }
}

function applyBaseProperties(
  announce = true,
  element = selectedElement.value,
  values: ElementFormSnapshot = getElementFormSnapshot(),
) {
  const object = element?.businessObject
  const modeling = service<Modeling>('modeling')
  const registry = service<ElementRegistry>('elementRegistry')
  if (!element || !object || !modeling) return
  const nextId = values.id.trim()
  if (!nextId) return ElMessage.error('元素 ID 不能为空')
  const existing = registry?.get(nextId)
  if (existing && existing !== element) return ElMessage.error('元素 ID 已存在')
  const nextName = values.name.trim()
  const baseProperties: Record<string, unknown> = {}
  if (object.id !== nextId) baseProperties.id = nextId
  if ((object.name || '') !== nextName) baseProperties.name = nextName
  if (Object.keys(baseProperties).length) modeling.updateProperties(element, baseProperties)
  let conditionChanged = false
  if (object.$type === 'bpmn:SequenceFlow') {
    const nextExpression = values.conditionExpression.trim()
    const currentExpression = readExpression(object.conditionExpression)
    const expression = nextExpression
      ? service<Moddle>('moddle')?.create('bpmn:FormalExpression', {
          body: nextExpression,
        })
      : undefined
    conditionChanged = currentExpression !== nextExpression
    if (conditionChanged) {
      modeling.updateModdleProperties(element, object, { conditionExpression: expression })
    }
  }
  const nextDocumentation = values.documentation.trim()
  const currentDocumentation =
    object.documentation?.map((item) => item.text || item.body || '').join('\n') || ''
  const documentation = nextDocumentation
    ? [
        service<Moddle>('moddle')?.create('bpmn:Documentation', {
          text: nextDocumentation,
        }),
      ]
    : []
  if (currentDocumentation !== nextDocumentation) {
    modeling.updateModdleProperties(element, object, { documentation })
  }
  if (
    Object.keys(baseProperties).length ||
    currentDocumentation !== nextDocumentation ||
    conditionChanged
  ) {
    dirty.value = true
  }
  if (announce) ElMessage.success('元素属性已应用')
}

function applyBasePropertiesAfterBlur() {
  const element = elementBeingEdited.value || selectedElement.value
  const values = getElementFormSnapshot()
  const sequence = elementEditSequence
  window.setTimeout(() => {
    applyBaseProperties(false, element, values)
    if (sequence === elementEditSequence) elementBeingEdited.value = undefined
  }, 0)
}

function beginBasePropertiesEdit() {
  elementBeingEdited.value = selectedElement.value
  elementEditSequence += 1
}

function applyMode(mode: ApprovalMode) {
  approvalMode.value = mode
  if (!mode) return
  const element = ensureUserTaskElement(selectedElement.value)
  const object = element?.businessObject
  const modeling = service<Modeling>('modeling')
  const moddle = service<Moddle>('moddle')
  if (!element || !object || !modeling || !moddle) return
  const properties: Record<string, unknown> = {
    assignee: undefined,
    candidateUsers: undefined,
    candidateGroups: undefined,
    loopCharacteristics: undefined,
  }
  if (mode === 'single') properties.assignee = DEFAULT_ASSIGNEE
  if (mode === 'candidate') {
    properties.candidateUsers = DEFAULT_CANDIDATE_USERS
    properties.candidateGroups = DEFAULT_CANDIDATE_GROUPS
  }
  if (mode === 'parallel') {
    properties.assignee = '${assignee}'
    properties.loopCharacteristics = moddle.create('bpmn:MultiInstanceLoopCharacteristics', {
      isSequential: false,
      collection: DEFAULT_COUNTERSIGN_COLLECTION,
      elementVariable: 'assignee',
      completionCondition: moddle.create('bpmn:FormalExpression', {
        body: '${nrOfCompletedInstances == nrOfInstances}',
      }),
    })
  }
  modeling.updateModdleProperties(element, object, properties)
  resetSelection(element)
  dirty.value = true
}

function writeListeners(kind: ListenerKind, values: string[]) {
  const element = selectedElement.value
  const object = element?.businessObject
  const modeling = service<Modeling>('modeling')
  const moddle = service<Moddle>('moddle')
  if (!element || !object || !modeling || !moddle) return
  const spec = {
    executionStart: { type: 'flowable:ExecutionListener', event: 'start' },
    executionEnd: { type: 'flowable:ExecutionListener', event: 'end' },
    taskCreate: { type: 'flowable:TaskListener', event: 'create' },
    taskComplete: { type: 'flowable:TaskListener', event: 'complete' },
  }[kind]
  let extensionElements = object.extensionElements
  if (!extensionElements) {
    extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] })
    modeling.updateModdleProperties(element, object, { extensionElements })
  }
  const retained = (extensionElements.values || []).filter(
    (item) => !(item.$type === spec.type && item.event === spec.event),
  )
  const created = values.map((value) =>
    moddle.create(spec.type, { event: spec.event, delegateExpression: `\${${value}}` }),
  )
  modeling.updateModdleProperties(element, extensionElements, { values: [...retained, ...created] })
  dirty.value = true
}

function addListener() {
  const value = normalizeListener(listenerForm.bean)
  if (!value) return ElMessage.error('请输入监听器 Bean 名称')
  if (listenerForm.kind.startsWith('task') && !isTask.value) {
    return ElMessage.error('任务监听器只能配置在用户任务上')
  }
  if (!listeners[listenerForm.kind].includes(value)) listeners[listenerForm.kind].push(value)
  writeListeners(listenerForm.kind, listeners[listenerForm.kind])
  listenerForm.bean = ''
}

function removeListener(kind: ListenerKind, index: number) {
  listeners[kind].splice(index, 1)
  writeListeners(kind, listeners[kind])
}

async function upload(file?: File) {
  if (!file) return
  try {
    const xml = await file.text()
    const document = validateBpmnXml(xml)
    const process = Array.from(document.getElementsByTagName('*')).find(
      (node) => node.localName === 'process',
    )
    processForm.key = process?.getAttribute('id') || processForm.key
    processForm.name = process?.getAttribute('name') || processForm.key
    await importXml(xml, true)
    ElMessage.success(`已导入 ${file.name}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function download() {
  if (!modeler.value) return
  sanitizeModel()
  const { xml } = await modeler.value.saveXML({ format: true })
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${processForm.key || 'workflow'}.bpmn20.xml`
  anchor.click()
  URL.revokeObjectURL(url)
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(() => (dirty.value ? window.confirm('流程图尚未保存，确认离开？') : true))

onMounted(async () => {
  if (!canvasElement.value) return
  modeler.value = new BpmnModeler({
    container: canvasElement.value,
    additionalModules: [workflowPaletteModule],
    moddleExtensions: { flowable: flowableModdle },
  })
  modeler.value.on('selection.changed', (event) => resetSelection(event.newSelection?.[0]))
  modeler.value.on('commandStack.changed', () => {
    if (!importing.value) dirty.value = true
  })
  modeler.value.on('shape.added', (event) => {
    const element = event.element
    window.setTimeout(() => {
      if (ensureDefaultUserTaskAssignment(element) && selectedElement.value?.id === element?.id) {
        resetSelection(element)
      }
    }, 0)
  })
  window.addEventListener('beforeunload', beforeUnload)

  const key = String(route.query.key || '')
  const name = String(route.query.name || key)
  const draft = String(route.query.draft || '')
  processForm.key = key
  processForm.name = name
  if (draft) {
    let xml = draft
    try {
      xml = decodeURIComponent(draft)
    } catch {
      /* query was already decoded */
    }
    await importXml(xml, true)
  } else if (key) {
    await loadVersions(key)
  } else {
    await importXml(createBlankBpmn('new_process', '新流程'), true)
    processForm.key = 'new_process'
    processForm.name = '新流程'
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  modeler.value?.destroy()
})

watch(selectedVersion, () => resetSelection())
</script>

<template>
  <div class="designer-page" v-loading="loading">
    <header class="designer-toolbar">
      <div class="designer-heading">
        <button
          class="designer-back-button"
          type="button"
          @click="router.push('/process-definitions')"
        >
          <ArrowLeft :size="17" /><span>返回</span>
        </button>
        <span class="designer-heading-divider" />
        <div>
          <span class="designer-breadcrumb">流程定义 / 编辑</span>
          <div class="designer-title-row">
            <strong>{{ processForm.name || processForm.key || '未命名流程' }}</strong>
            <span v-if="dirty" class="dirty-badge">未保存修改</span>
          </div>
        </div>
      </div>
      <div class="designer-toolbar-actions">
        <el-button @click="fileInput?.click()"><FileUp :size="16" />导入</el-button>
        <el-button @click="download"><Download :size="16" />导出</el-button>
        <span class="toolbar-action-divider" />
        <el-button @click="openNewProcessDialog"><Plus :size="16" />新建流程图</el-button>
        <el-button type="primary" :loading="saving" @click="saveVersion">
          <Save :size="16" />保存新版本
        </el-button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".bpmn,.xml,.bpmn20.xml"
        hidden
        @change="upload(($event.target as HTMLInputElement).files?.[0])"
      />
    </header>

    <div class="designer-workspace">
      <div ref="canvasElement" class="bpmn-canvas" />
      <aside class="properties-panel">
        <section class="inspector-card">
          <div class="inspector-heading">
            <div>
              <h2>流程概览</h2>
              <p>基本标识只读，创建时确定</p>
            </div>
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="流程定义 ID">
              <el-input :model-value="processForm.key" readonly />
            </el-form-item>
            <el-form-item label="流程定义名称">
              <el-input :model-value="processForm.name" aria-label="流程名称" readonly />
            </el-form-item>
          </el-form>
        </section>

        <section class="inspector-card">
          <div class="inspector-heading">
            <div>
              <h2>版本管理</h2>
              <p>保存生成新版本，发布决定运行版本</p>
            </div>
          </div>
          <div class="version-status-row">
            <span>当前已发布</span>
            <el-tag :type="activeVersion ? 'success' : 'info'" effect="plain">
              <CheckCircle2 v-if="activeVersion" :size="13" />
              {{ activeVersion ? formatVersion(activeVersion.version) : '未发布' }}
            </el-tag>
          </div>
          <el-select
            :model-value="selectedVersion"
            placeholder="暂无版本"
            :disabled="versions.length === 0 || loading"
            @change="openVersion"
          >
            <el-option
              v-for="item in versions"
              :key="item.version"
              :label="`${formatVersion(item.version)} · ${formatDateTime(item.deployedAt)}`"
              :value="item.version"
            />
          </el-select>
          <el-button
            type="primary"
            :disabled="!selectedVersion || isSelectedActive"
            :loading="publishing"
            @click="publishVersion"
          >
            {{ isSelectedActive ? '当前版本已发布' : '发布当前版本' }}
          </el-button>
          <el-button :disabled="!selectedDefinition" :loading="inheriting" @click="inheritRules">
            <Copy :size="15" />继承配置
          </el-button>
          <div class="danger-zone">
            <span>危险操作</span>
            <el-button type="danger" plain :disabled="!selectedVersion" @click="deleteVersion">
              <Trash2 :size="15" />删除当前版本
            </el-button>
            <el-button type="danger" plain :disabled="!versions.length" @click="deleteDefinition">
              <Trash2 :size="15" />删除流程图
            </el-button>
          </div>
        </section>

        <section class="inspector-card element-card">
          <div class="inspector-heading">
            <div>
              <h2>元素配置</h2>
              <p>选中画布中的节点、网关或连线后编辑</p>
            </div>
          </div>
          <template v-if="selectedElement">
            <div class="property-block base-properties">
              <strong>基础信息</strong>
              <el-form label-position="top" size="small">
                <el-form-item label="元素 ID">
                  <el-input
                    v-model="elementForm.id"
                    @focus="beginBasePropertiesEdit"
                    @blur="applyBasePropertiesAfterBlur"
                  />
                </el-form-item>
                <el-form-item label="元素名称">
                  <el-input
                    v-model="elementForm.name"
                    @focus="beginBasePropertiesEdit"
                    @blur="applyBasePropertiesAfterBlur"
                  />
                </el-form-item>
                <el-form-item label="文档说明">
                  <el-input
                    v-model="elementForm.documentation"
                    type="textarea"
                    :rows="3"
                    @focus="beginBasePropertiesEdit"
                    @blur="applyBasePropertiesAfterBlur"
                  />
                </el-form-item>
              </el-form>
            </div>

            <div v-if="isTask || isSequenceFlow" class="property-block">
              <strong>流转规则</strong>
              <el-form label-position="top" size="small">
                <el-form-item v-if="isTask" label="环节类型">
                  <el-select
                    v-model="approvalMode"
                    placeholder="请选择环节类型"
                    @change="applyMode"
                  >
                    <el-option label="单人环节" value="single" />
                    <el-option label="抢签环节" value="candidate" />
                    <el-option label="会签环节" value="parallel" />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="isSequenceFlow" label="连线条件">
                  <el-input
                    v-model="elementForm.conditionExpression"
                    type="textarea"
                    :rows="3"
                    placeholder="${operationType == 'agree'}"
                    @focus="beginBasePropertiesEdit"
                    @blur="applyBasePropertiesAfterBlur"
                  />
                </el-form-item>
              </el-form>
            </div>

            <div class="property-block technical-info">
              <strong>技术信息</strong>
              <dl>
                <dt>类型</dt>
                <dd>{{ elementTypeLabel }}</dd>
                <template v-if="selectedSource || selectedTarget">
                  <dt>来源</dt>
                  <dd>{{ selectedSource || '-' }}</dd>
                  <dt>目标</dt>
                  <dd>{{ selectedTarget || '-' }}</dd>
                </template>
                <template v-if="elementForm.conditionExpression">
                  <dt>条件</dt>
                  <dd>
                    <code>{{ elementForm.conditionExpression }}</code>
                  </dd>
                </template>
                <template v-if="elementForm.documentation">
                  <dt>说明</dt>
                  <dd>{{ elementForm.documentation }}</dd>
                </template>
              </dl>
              <div v-if="extensionAttributes.length" class="extension-attributes">
                <p v-for="attribute in extensionAttributes" :key="attribute.key">
                  <span>{{ attribute.key }}</span
                  ><code>{{ attribute.value }}</code>
                </p>
              </div>
            </div>

            <div class="property-block listener-editor">
              <strong>监听器</strong>
              <el-select v-model="listenerForm.kind">
                <el-option
                  v-for="section in availableListenerSections"
                  :key="section.kind"
                  :label="section.label"
                  :value="section.kind"
                />
              </el-select>
              <div class="listener-input">
                <el-input
                  v-model="listenerForm.bean"
                  placeholder="监听器 Bean 名称"
                  @keyup.enter="addListener"
                />
                <el-button @click="addListener">添加</el-button>
              </div>
              <div class="listener-table">
                <div class="listener-table-head">
                  <span>序号</span><span>事件类型</span><span>监听器 Bean</span><span>操作</span>
                </div>
                <div v-if="listenerRows.length === 0" class="listener-empty-row">暂无数据</div>
                <template v-else>
                  <div
                    v-for="(row, index) in listenerRows"
                    :key="`${row.kind}-${row.listener}-${row.index}`"
                    class="listener-table-row"
                  >
                    <span>{{ index + 1 }}</span>
                    <span>{{ row.label }}</span>
                    <code>{{ row.listener }}</code>
                    <button
                      class="listener-remove"
                      type="button"
                      aria-label="删除监听器"
                      @click="removeListener(row.kind, row.index)"
                    >
                      ×
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </template>
          <p v-else class="property-empty">点击画布中的任务、网关、事件或连线查看信息</p>
        </section>
      </aside>
    </div>

    <el-dialog v-model="newProcessVisible" title="新建流程图" width="480px" destroy-on-close>
      <el-form label-position="top" @submit.prevent="createNewProcess">
        <el-form-item label="流程定义 ID" required>
          <el-input
            v-model="newProcessForm.key"
            maxlength="64"
            placeholder="applyApprovalProcess"
          />
        </el-form-item>
        <el-form-item label="流程定义名称" required>
          <el-input v-model="newProcessForm.name" maxlength="128" placeholder="申请审批流程" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newProcessVisible = false">取消</el-button>
        <el-button type="primary" :loading="newProcessSaving" @click="createNewProcess">
          创建空白画布
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
