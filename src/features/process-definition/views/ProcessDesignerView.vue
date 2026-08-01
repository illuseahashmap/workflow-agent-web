<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileUp,
  GitPullRequestArrow,
  Save,
  Trash2,
} from '@lucide/vue'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import { getErrorMessage } from '@/api/http'
import flowableModdle from '@/bpmn/flowableModdle'
import type {
  ApprovalMode,
  BpmnElement,
  BpmnModelerInstance,
  Canvas,
  ElementRegistry,
  ListenerKind,
  Moddle,
  ModdleElement,
  Modeling,
} from '@/bpmn/modeler-types'
import { assignmentRuleApi } from '@/features/assignment-rule/api'
import { createBlankBpmn, validateBpmnXml } from '@/utils/bpmn'
import { formatDateTime } from '@/utils/format'
import { definitionApi } from '../api'
import type { ActiveProcessVersion, ProcessDefinition } from '../types'

const DEFAULT_ASSIGNEE = '${assigneeService.getAssignee(execution)}'
const DEFAULT_CANDIDATE_USERS = '${assigneeService.getCandidates(execution)}'
const DEFAULT_CANDIDATE_GROUPS = '${assigneeService.getCandidateGroups(execution)}'
const DEFAULT_COUNTERSIGN_COLLECTION = '${assigneeService.getAssigneeList(execution)}'

const route = useRoute()
const router = useRouter()
const canvasElement = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()
const modeler = ref<BpmnModelerInstance>()
const versions = ref<ProcessDefinition[]>([])
const activeVersion = ref<ActiveProcessVersion>()
const selectedVersion = ref<number>()
const loading = ref(false)
const saving = ref(false)
const dirty = ref(false)
const importing = ref(false)
const processForm = reactive({ key: '', name: '' })
const selectedElement = ref<BpmnElement>()
const elementForm = reactive({ id: '', name: '', documentation: '', conditionExpression: '' })
const approvalMode = ref<ApprovalMode>('')
const listenerForm = reactive({ kind: 'executionStart' as ListenerKind, bean: '' })
const listeners = reactive<Record<ListenerKind, string[]>>({
  executionStart: [],
  executionEnd: [],
  taskCreate: [],
  taskComplete: [],
})

const selectedBusinessObject = computed(() => selectedElement.value?.businessObject)
const selectedType = computed(
  () => selectedBusinessObject.value?.$type || selectedElement.value?.type || '',
)
const isTask = computed(() => ['bpmn:Task', 'bpmn:UserTask'].includes(selectedType.value))
const isSequenceFlow = computed(() => selectedType.value === 'bpmn:SequenceFlow')
const isSelectedActive = computed(() => activeVersion.value?.version === selectedVersion.value)
const selectedDefinition = computed(() =>
  versions.value.find((item) => item.version === selectedVersion.value),
)
const versionLabel = computed(() =>
  selectedVersion.value ? `v${selectedVersion.value}` : '未部署',
)

function service<T>(name: string) {
  return modeler.value?.get(name) as T | undefined
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
}

function sanitizeAttributes(object?: ModdleElement | string) {
  if (!object || typeof object === 'string' || !object.$attrs) return
  for (const key of Object.keys(object.$attrs)) {
    if (key.startsWith('$') || key.startsWith('flowable:')) delete object.$attrs[key]
  }
}

function sanitizeModel() {
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
    ElMessage.success(`已保存为 v${result.version}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function publishVersion() {
  if (!selectedVersion.value) return
  try {
    activeVersion.value = await definitionApi.activate({
      processDefinitionKey: processForm.key,
      version: selectedVersion.value,
    })
    ElMessage.success(`已发布 v${selectedVersion.value}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}

async function inheritRules() {
  const definition = selectedDefinition.value
  if (!definition) return
  await ElMessageBox.confirm('将从最近有配置的历史版本继承派单规则，是否继续？', '继承派单规则', {
    confirmButtonText: '继承',
    cancelButtonText: '取消',
  })
  try {
    const result = await assignmentRuleApi.inherit(definition.processDefinitionId)
    const skipped = result.skippedReasons.length
      ? `；跳过：${result.skippedReasons.join('；')}`
      : ''
    ElMessage.success(`已复制 ${result.copiedCount} 条，跳过 ${result.skippedCount} 条${skipped}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}

async function deleteVersion() {
  if (!selectedVersion.value) return
  const version = selectedVersion.value
  await ElMessageBox.confirm(`确认删除 ${processForm.key} v${version}？`, '删除版本', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  try {
    await definitionApi.deleteVersion(processForm.key, version)
    ElMessage.success(`v${version} 已删除`)
    await loadVersions(processForm.key)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}

function applyBaseProperties() {
  const element = selectedElement.value
  const object = element?.businessObject
  const modeling = service<Modeling>('modeling')
  const registry = service<ElementRegistry>('elementRegistry')
  if (!element || !object || !modeling) return
  const nextId = elementForm.id.trim()
  if (!nextId) return ElMessage.error('元素 ID 不能为空')
  const existing = registry?.get(nextId)
  if (existing && existing !== element) return ElMessage.error('元素 ID 已存在')
  modeling.updateProperties(element, { id: nextId, name: elementForm.name.trim() })
  if (object.$type === 'bpmn:SequenceFlow') {
    const expression = elementForm.conditionExpression.trim()
      ? service<Moddle>('moddle')?.create('bpmn:FormalExpression', {
          body: elementForm.conditionExpression.trim(),
        })
      : undefined
    modeling.updateModdleProperties(element, object, { conditionExpression: expression })
  }
  const documentation = elementForm.documentation.trim()
    ? [
        service<Moddle>('moddle')?.create('bpmn:Documentation', {
          text: elementForm.documentation.trim(),
        }),
      ]
    : []
  modeling.updateModdleProperties(element, object, { documentation })
  dirty.value = true
  ElMessage.success('元素属性已应用')
}

function applyMode(mode: ApprovalMode) {
  approvalMode.value = mode
  const element = selectedElement.value
  const object = element?.businessObject
  const modeling = service<Modeling>('modeling')
  const moddle = service<Moddle>('moddle')
  if (!element || !object || !modeling || !moddle || object.$type !== 'bpmn:UserTask') return
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
    moddleExtensions: { flowable: flowableModdle },
  })
  modeler.value.on('selection.changed', (event) => resetSelection(event.newSelection?.[0]))
  modeler.value.on('commandStack.changed', () => {
    if (!importing.value) dirty.value = true
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
      <el-tooltip content="返回流程定义">
        <button class="icon-button" type="button" @click="router.push('/process-definitions')">
          <ArrowLeft :size="18" />
        </button>
      </el-tooltip>
      <div class="designer-identity">
        <el-input v-model="processForm.name" aria-label="流程名称" />
        <span>{{ processForm.key }}</span>
      </div>
      <div class="designer-version">
        <el-select
          :model-value="selectedVersion"
          placeholder="未部署"
          :disabled="versions.length === 0"
          @change="openVersion"
        >
          <el-option
            v-for="item in versions"
            :key="item.version"
            :label="`v${item.version}`"
            :value="item.version"
          />
        </el-select>
        <el-tag :type="isSelectedActive ? 'success' : 'info'" effect="plain">
          {{ isSelectedActive ? '当前发布' : versionLabel }}
        </el-tag>
      </div>
      <div class="toolbar-spacer" />
      <input
        ref="fileInput"
        type="file"
        accept=".bpmn,.xml,.bpmn20.xml"
        hidden
        @change="upload(($event.target as HTMLInputElement).files?.[0])"
      />
      <el-button @click="fileInput?.click()"><FileUp :size="16" />导入</el-button>
      <el-button @click="download"><Download :size="16" />导出 XML</el-button>
      <el-dropdown v-if="selectedVersion">
        <el-button>版本操作</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item :disabled="isSelectedActive" @click="publishVersion"
              ><CheckCircle2 :size="15" />发布此版本</el-dropdown-item
            >
            <el-dropdown-item @click="inheritRules"
              ><GitPullRequestArrow :size="15" />继承派单规则</el-dropdown-item
            >
            <el-dropdown-item divided @click="deleteVersion"
              ><Trash2 :size="15" />删除此版本</el-dropdown-item
            >
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button type="primary" :loading="saving" @click="saveVersion"
        ><Save :size="16" />保存新版本</el-button
      >
    </header>

    <div class="designer-workspace">
      <div ref="canvasElement" class="bpmn-canvas" />
      <aside class="properties-panel">
        <template v-if="selectedElement">
          <div class="properties-heading">
            <div>
              <strong>{{ elementForm.name || elementForm.id }}</strong
              ><span>{{ selectedType }}</span>
            </div>
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="元素 ID"><el-input v-model="elementForm.id" /></el-form-item>
            <el-form-item label="名称"><el-input v-model="elementForm.name" /></el-form-item>
            <el-form-item v-if="isSequenceFlow" label="条件表达式">
              <el-input
                v-model="elementForm.conditionExpression"
                placeholder="${approved == true}"
              />
            </el-form-item>
            <el-form-item label="文档说明"
              ><el-input v-model="elementForm.documentation" type="textarea" :rows="3"
            /></el-form-item>
            <el-button class="full-button" @click="applyBaseProperties">应用基础属性</el-button>
          </el-form>

          <section v-if="selectedType === 'bpmn:UserTask'" class="property-section">
            <h3>任务模式</h3>
            <el-radio-group v-model="approvalMode" @change="applyMode">
              <el-radio-button value="single">单人</el-radio-button>
              <el-radio-button value="candidate">候选</el-radio-button>
              <el-radio-button value="parallel">会签</el-radio-button>
            </el-radio-group>
          </section>

          <section class="property-section">
            <h3>监听器</h3>
            <el-select v-model="listenerForm.kind" class="full-control">
              <el-option label="执行启动" value="executionStart" />
              <el-option label="执行结束" value="executionEnd" />
              <el-option v-if="isTask" label="任务创建" value="taskCreate" />
              <el-option v-if="isTask" label="任务完成" value="taskComplete" />
            </el-select>
            <div class="listener-input">
              <el-input
                v-model="listenerForm.bean"
                placeholder="listenerBean"
                @keyup.enter="addListener"
              /><el-button @click="addListener">添加</el-button>
            </div>
            <div class="listener-list">
              <template v-for="(items, kind) in listeners" :key="kind">
                <div v-for="(item, index) in items" :key="`${kind}-${item}`" class="listener-row">
                  <span
                    ><small>{{ kind }}</small
                    ><code>{{ '${' + item + '}' }}</code></span
                  >
                  <el-button link type="danger" @click="removeListener(kind as ListenerKind, index)"
                    >删除</el-button
                  >
                </div>
              </template>
            </div>
          </section>
        </template>
        <div v-else class="property-empty">选择画布中的元素以编辑属性</div>
        <footer v-if="selectedDefinition" class="properties-footer">
          <span>{{ selectedDefinition.processDefinitionId }}</span>
          <span>部署时间 {{ formatDateTime(activeVersion?.activatedAt) }}</span>
        </footer>
      </aside>
    </div>
  </div>
</template>
