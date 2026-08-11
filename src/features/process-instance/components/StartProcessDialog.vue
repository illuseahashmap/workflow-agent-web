<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { Plus, Trash2 } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { definitionApi, type ProcessDefinition } from '@/features/process-definition'
import { useAuthStore } from '@/stores/auth'
import { formatVersion } from '@/utils/format'
import { resolveStartFrontierKinds } from '@/utils/bpmn'
import { processInstanceApi } from '../api'
import ParticipantAssignmentEditor from './ParticipantAssignmentEditor.vue'
import {
  buildProcessVariables,
  type ProcessVariableDraft,
  type ProcessVariableType,
} from '../startProcess'
import type { ParticipantAssignment, ParticipantRequirement, StartProcessResult } from '../types'

const props = defineProps<{
  modelValue: boolean
  initialProcessDefinitionKey?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  started: [result: StartProcessResult]
}>()

const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const form = reactive({ processDefinitionId: '', businessKey: '' })
const variableRows = ref<ProcessVariableDraft[]>([])
const participantRequirements = ref<ParticipantRequirement[]>([])
const participantAssignments = ref<ParticipantAssignment[]>([])
const selectedDefinitionXml = ref('')
const preparedVariables = ref<Record<string, unknown>>()
const requirementsLoaded = ref(false)
let previewTimer: ReturnType<typeof setTimeout> | undefined
let previewGeneration = 0

const definitionsQuery = useQuery({
  queryKey: computed(() => queryKeys.processDefinitionCatalog(tenantCode.value)),
  queryFn: () => definitionApi.listProcesses(),
  enabled: computed(() => props.modelValue),
})

const activeDefinitions = computed(() => {
  const definitions = (definitionsQuery.data.value ?? []).filter((item) => item.active)
  const byKey = new Map<string, ProcessDefinition>()
  definitions.forEach((item) => {
    const current = byKey.get(item.processDefinitionKey)
    if (!current || item.version > current.version) byKey.set(item.processDefinitionKey, item)
  })
  return [...byKey.values()].sort((left, right) =>
    left.processDefinitionName.localeCompare(right.processDefinitionName, 'zh-CN'),
  )
})

const selectedDefinition = computed(() =>
  activeDefinitions.value.find((item) => item.processDefinitionId === form.processDefinitionId),
)

const startFrontier = computed(() => {
  if (!selectedDefinitionXml.value) return { hasAgentWait: false, hasUserTask: false }
  try {
    return resolveStartFrontierKinds(selectedDefinitionXml.value)
  } catch {
    return { hasAgentWait: false, hasUserTask: false }
  }
})

let definitionLoadSequence = 0

async function loadSelectedDefinitionXml() {
  const definition = selectedDefinition.value
  if (!definition) {
    selectedDefinitionXml.value = ''
    return
  }
  if (definition.bpmnXml) {
    selectedDefinitionXml.value = definition.bpmnXml
    return
  }
  const sequence = ++definitionLoadSequence
  try {
    const detail = await definitionApi.detail(definition.processDefinitionKey, definition.version)
    if (
      sequence === definitionLoadSequence &&
      detail.processDefinitionId === definition.processDefinitionId
    ) {
      selectedDefinitionXml.value = detail.bpmnXml
    }
  } catch {
    if (sequence === definitionLoadSequence) selectedDefinitionXml.value = ''
  }
}

watch(
  [() => props.modelValue, activeDefinitions, () => props.initialProcessDefinitionKey],
  ([visible]) => {
    if (!visible || form.processDefinitionId) return
    const preferred = activeDefinitions.value.find(
      (item) => item.processDefinitionKey === props.initialProcessDefinitionKey,
    )
    if (preferred) form.processDefinitionId = preferred.processDefinitionId
    else if (activeDefinitions.value.length === 1)
      form.processDefinitionId = activeDefinitions.value[0]!.processDefinitionId
  },
  { immediate: true },
)

const startMutation = useMutation({
  mutationFn: (payload: {
    variables: Record<string, unknown>
    participantAssignments: ParticipantAssignment[]
  }) => {
    const definition = selectedDefinition.value
    if (!definition) throw new Error('请选择已发布的流程')
    return processInstanceApi.start({
      processDefinitionKey: definition.processDefinitionKey,
      processDefinitionId: definition.processDefinitionId,
      businessKey: form.businessKey.trim() || undefined,
      variables: payload.variables,
      participantAssignments: payload.participantAssignments,
    })
  },
  onSuccess: async (result) => {
    ElMessage.success('流程实例已发起')
    emit('update:modelValue', false)
    await queryClient.invalidateQueries({ queryKey: queryKeys.processInstances(tenantCode.value) })
    emit('started', result)
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

type RequirementsPreview = {
  definition: ProcessDefinition
  generation: number
  startWhenReady: boolean
  variables: Record<string, unknown>
}

const requirementsMutation = useMutation({
  mutationFn: async (preview: RequirementsPreview) => ({
    preview,
    requirements: await processInstanceApi.startParticipantRequirements({
      processDefinitionKey: preview.definition.processDefinitionKey,
      processDefinitionId: preview.definition.processDefinitionId,
      variables: preview.variables,
    }),
  }),
  onSuccess: ({ preview, requirements }) => {
    if (preview.generation !== previewGeneration) return
    preparedVariables.value = preview.variables
    participantRequirements.value = requirements
    const activityIds = new Set(requirements.map((requirement) => requirement.activityId))
    participantAssignments.value = participantAssignments.value.filter((assignment) =>
      activityIds.has(assignment.activityId),
    )
    requirementsLoaded.value = true
    if (preview.startWhenReady) continueStart()
  },
  onError: (error, preview) => {
    if (preview.generation !== previewGeneration) return
    requirementsLoaded.value = false
    if (preview.startWhenReady) ElMessage.error(getErrorMessage(error))
  },
})

async function requestRequirements(startWhenReady: boolean) {
  const definition = selectedDefinition.value
  if (!definition) {
    if (startWhenReady) ElMessage.warning('请选择已发布的流程')
    return
  }
  await loadSelectedDefinitionXml()
  let variables: Record<string, unknown>
  try {
    variables = buildProcessVariables(variableRows.value)
  } catch (error) {
    if (startWhenReady) ElMessage.error(getErrorMessage(error))
    return
  }
  if (startFrontier.value.hasAgentWait && !startFrontier.value.hasUserTask) {
    preparedVariables.value = variables
    participantRequirements.value = []
    participantAssignments.value = []
    requirementsLoaded.value = true
    if (startWhenReady) continueStart()
    return
  }
  const generation = ++previewGeneration
  requirementsLoaded.value = false
  requirementsMutation.mutate({ definition, generation, startWhenReady, variables })
}

function scheduleRequirementsPreview() {
  previewGeneration += 1
  requirementsLoaded.value = false
  preparedVariables.value = undefined
  participantRequirements.value = []
  participantAssignments.value = []
  selectedDefinitionXml.value = ''
  if (previewTimer) clearTimeout(previewTimer)
  if (!props.modelValue || !selectedDefinition.value) return
  previewTimer = setTimeout(() => requestRequirements(false), 300)
}

watch(
  [() => form.processDefinitionId, () => JSON.stringify(variableRows.value)],
  scheduleRequirementsPreview,
)

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer)
})

function addVariable() {
  variableRows.value.push({ name: '', type: 'string', value: '' })
}

function removeVariable(index: number) {
  variableRows.value.splice(index, 1)
}

function resetForm() {
  form.processDefinitionId = ''
  form.businessKey = ''
  variableRows.value = []
  participantRequirements.value = []
  participantAssignments.value = []
  preparedVariables.value = undefined
  requirementsLoaded.value = false
  previewGeneration += 1
  if (previewTimer) clearTimeout(previewTimer)
}

function continueStart() {
  if (!participantRequirements.value.length) {
    startMutation.mutate({
      variables: preparedVariables.value ?? buildProcessVariables(variableRows.value),
      participantAssignments: [],
    })
    return
  }
  const complete = participantRequirements.value.every((requirement) => {
    if (!requirement.required) return true
    const users = participantAssignments.value.find(
      (item) => item.activityId === requirement.activityId,
    )?.usernames
    return requirement.multiple ? Boolean(users?.length) : users?.length === 1
  })
  if (!complete) {
    ElMessage.warning('请为所有待派单环节选择参与人')
    return
  }
  startMutation.mutate({
    variables: preparedVariables.value ?? buildProcessVariables(variableRows.value),
    participantAssignments: participantAssignments.value,
  })
}

function submit() {
  if (requirementsLoaded.value) continueStart()
  else requestRequirements(true)
}

function variablePlaceholder(type: ProcessVariableType) {
  return {
    string: '输入文本',
    number: '例如 100',
    boolean: '选择布尔值',
    json: '例如 {"key":"value"}',
  }[type]
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="发起流程"
    width="min(800px, calc(100vw - 32px))"
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="resetForm"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="已发布流程" required>
        <el-select
          v-model="form.processDefinitionId"
          filterable
          :loading="definitionsQuery.isFetching.value"
          :disabled="definitionsQuery.isFetching.value && !activeDefinitions.length"
          loading-text="正在加载已发布流程"
          no-data-text="当前租户暂无已发布流程"
          placeholder="请选择要发起的流程"
        >
          <el-option
            v-for="definition in activeDefinitions"
            :key="definition.processDefinitionId"
            :label="`${definition.processDefinitionName} / ${definition.processDefinitionKey} · ${formatVersion(definition.version)}`"
            :value="definition.processDefinitionId"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="业务标识">
        <el-input
          v-model="form.businessKey"
          maxlength="128"
          placeholder="选填，例如 LEAVE-2026-0001"
        />
      </el-form-item>

      <section class="variable-section">
        <div class="variable-section__heading">
          <div>
            <h3>业务变量</h3>
            <p>选填，派单条件和流程表达式可以使用这些变量。</p>
          </div>
          <el-button link type="primary" @click="addVariable"
            ><Plus :size="15" />添加变量</el-button
          >
        </div>
        <div
          v-if="variableRows.length"
          class="variable-grid variable-grid--header"
          aria-hidden="true"
        >
          <span>变量名</span><span>类型</span><span>变量值</span><span />
        </div>
        <div v-for="(row, index) in variableRows" :key="index" class="variable-grid">
          <el-input v-model="row.name" placeholder="例如 amount" />
          <el-select v-model="row.type">
            <el-option label="文本" value="string" />
            <el-option label="数字" value="number" />
            <el-option label="布尔值" value="boolean" />
            <el-option label="JSON" value="json" />
          </el-select>
          <el-select v-if="row.type === 'boolean'" v-model="row.value" placeholder="请选择">
            <el-option label="是（true）" value="true" />
            <el-option label="否（false）" value="false" />
          </el-select>
          <el-input v-else v-model="row.value" :placeholder="variablePlaceholder(row.type)" />
          <el-button
            class="variable-remove"
            text
            type="danger"
            aria-label="删除业务变量"
            @click="removeVariable(index)"
          >
            <Trash2 :size="15" />
          </el-button>
        </div>
        <div v-if="!variableRows.length" class="variable-empty">暂无业务变量</div>
      </section>
      <div
        v-if="selectedDefinition && requirementsMutation.isPending.value && !requirementsLoaded"
        class="participant-status participant-status--loading"
      >
        正在识别首个待处理环节的参与人方式…
      </div>
      <el-alert
        v-else-if="selectedDefinition && requirementsLoaded && !participantRequirements.length"
        class="participant-status"
        title="当前无需手工选人"
        description="系统会优先使用已配置的派单规则；如果流程先进入自动节点，也会在运行时继续识别参与人。"
        type="success"
        show-icon
        :closable="false"
      />
      <ParticipantAssignmentEditor
        v-model="participantAssignments"
        :requirements="participantRequirements"
      />
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button
        type="primary"
        :disabled="!selectedDefinition"
        :loading="startMutation.isPending.value || requirementsMutation.isPending.value"
        @click="submit"
      >
        {{ participantRequirements.length ? '确认发起' : '发起流程' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.variable-section {
  display: grid;
  gap: 10px;
  padding-top: 4px;
}

.variable-section__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.variable-section__heading h3,
.variable-section__heading p {
  margin: 0;
}

.variable-section__heading h3 {
  color: #1e293b;
  font-size: 14px;
}

.variable-section__heading p {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.variable-grid {
  display: grid;
  grid-template-columns: minmax(130px, 0.8fr) 112px minmax(170px, 1.2fr) 36px;
  align-items: center;
  gap: 8px;
}

.variable-grid--header {
  color: #64748b;
  font-size: 12px;
}

.variable-remove {
  width: 36px;
  margin: 0;
}

.variable-empty {
  padding: 18px 0;
  border: 1px dashed #dbe3ee;
  border-radius: 10px;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}

.participant-status {
  margin-top: 14px;
}

.participant-status--loading {
  padding: 13px 15px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fbff;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 620px) {
  .variable-grid {
    grid-template-columns: minmax(0, 1fr) 112px 36px;
  }

  .variable-grid > :nth-child(3) {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .variable-grid--header {
    display: none;
  }
}
</style>
