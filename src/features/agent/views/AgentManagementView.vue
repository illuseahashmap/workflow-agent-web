<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { Bot, CirclePlay, Plus, RefreshCw, Search, ServerCog, ShieldCheck } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import ListEmptyState from '@/components/ListEmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableTagCell from '@/components/TableTagCell.vue'
import { APP_PERMISSION, APP_ROLE, hasAccess } from '@/features/auth/authorization'
import { useAuthStore } from '@/stores/auth'
import { confirmAction } from '@/utils/confirmation'
import { formatDateTime, formatVersion } from '@/utils/format'
import { getStatusLabel } from '@/utils/status'
import { agentApi, agentProviderApi, agentRunApi } from '../api'
import { getAgentErrorPresentation } from '../errorPresentation'
import type {
  AgentDefinition,
  AgentDefinitionCommand,
  AgentFailurePolicy,
  AgentProvider,
  AgentProviderCommand,
  AgentProviderType,
  AgentRun,
  AgentRunStatus,
  AgentVersion,
  AgentVersionCommand,
} from '../types'

const authStore = useAuthStore()
const queryClient = useQueryClient()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const canManageAgents = computed(() =>
  hasAccess(authStore.user, {
    requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
    requiredAnyPermissions: [APP_PERMISSION.agentManage],
  }),
)
const canReadRuns = computed(() =>
  hasAccess(authStore.user, {
    requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
    requiredAnyPermissions: [APP_PERMISSION.agentRunRead],
  }),
)
const canExecuteRuns = computed(() =>
  hasAccess(authStore.user, {
    requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
    requiredAnyPermissions: [APP_PERMISSION.agentRunExecute],
  }),
)
const activeTab = ref(canManageAgents.value ? 'agents' : 'runs')
const agentRunStatuses: AgentRunStatus[] = [
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'TIMED_OUT',
  'CANCELLED',
]

const agentQuery = reactive({
  keyword: '',
  enabled: undefined as boolean | undefined,
  pageNum: 1,
  pageSize: 20,
})
const appliedAgentQuery = ref({ ...agentQuery })
const providerQuery = reactive({
  keyword: '',
  enabled: undefined as boolean | undefined,
  pageNum: 1,
  pageSize: 20,
})
const appliedProviderQuery = ref({ ...providerQuery })
const runQuery = reactive({
  keyword: '',
  status: undefined as AgentRunStatus | undefined,
  pageNum: 1,
  pageSize: 20,
})
const appliedRunQuery = ref({ ...runQuery })

const agentsQuery = useQuery({
  queryKey: computed(() => queryKeys.agentPage(tenantCode.value, appliedAgentQuery.value)),
  queryFn: () => agentApi.page(appliedAgentQuery.value),
  enabled: computed(() => Boolean(tenantCode.value && canManageAgents.value)),
})
const providersQuery = useQuery({
  queryKey: computed(() =>
    queryKeys.agentProviderPage(tenantCode.value, appliedProviderQuery.value),
  ),
  queryFn: () => agentProviderApi.page(appliedProviderQuery.value),
  enabled: computed(() => Boolean(tenantCode.value && canManageAgents.value)),
})
const enabledProvidersQuery = useQuery({
  queryKey: computed(() => queryKeys.enabledAgentProviders(tenantCode.value)),
  queryFn: agentProviderApi.enabled,
  enabled: computed(() => Boolean(tenantCode.value && canManageAgents.value)),
})
const runsQuery = useQuery({
  queryKey: computed(() => queryKeys.agentRunPage(tenantCode.value, appliedRunQuery.value)),
  queryFn: () => agentRunApi.page(appliedRunQuery.value),
  enabled: computed(() => Boolean(tenantCode.value && canReadRuns.value)),
})
const selectedRunId = ref<number>()
const runDetailVisible = ref(false)
const runDetailQuery = useQuery({
  queryKey: computed(() => queryKeys.agentRunDetail(tenantCode.value, selectedRunId.value || 0)),
  queryFn: () => agentRunApi.detail(selectedRunId.value!),
  enabled: computed(() =>
    Boolean(tenantCode.value && selectedRunId.value && runDetailVisible.value),
  ),
  refetchInterval: (query) => {
    const status = query.state.data?.run.status
    return status && !['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'CANCELLED'].includes(status)
      ? 1000
      : false
  },
})
watch(
  () => runDetailQuery.data.value?.run.status,
  (status) => {
    if (status && ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'CANCELLED'].includes(status)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns(tenantCode.value) })
    }
  },
)

const manualRunDialogVisible = ref(false)
const manualRunAgent = ref<AgentDefinition>()
const manualRunInput = ref('')
const submitManualRunMutation = useMutation({
  mutationFn: () =>
    agentRunApi.submitManual({
      definitionId: manualRunAgent.value!.id,
      input: manualRunInput.value.trim(),
    }),
  onSuccess: async (submission) => {
    manualRunDialogVisible.value = false
    activeTab.value = 'runs'
    selectedRunId.value = submission.runId
    runDetailVisible.value = true
    ElMessage.success(`测试运行 #${submission.runId} 已进入执行队列`)
    await queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns(tenantCode.value) })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

const agentDialogVisible = ref(false)
const editingAgentId = ref<number>()
const agentForm = reactive<AgentDefinitionCommand>({
  code: '',
  name: '',
  description: '',
  enabled: true,
})
const saveAgentMutation = useMutation({
  mutationFn: async () => {
    if (!agentForm.code.trim() || !agentForm.name.trim())
      throw new Error('Agent 编码和名称不能为空')
    const payload = {
      ...agentForm,
      code: agentForm.code.trim(),
      name: agentForm.name.trim(),
      description: agentForm.description?.trim(),
    }
    return editingAgentId.value
      ? agentApi.update(editingAgentId.value, payload)
      : agentApi.create(payload)
  },
  onSuccess: async () => {
    agentDialogVisible.value = false
    ElMessage.success(
      editingAgentId.value ? 'Agent 信息已更新' : `Agent 已创建，并生成草稿${formatVersion(1)}`,
    )
    await queryClient.invalidateQueries({ queryKey: queryKeys.agents(tenantCode.value) })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

const versionDialogVisible = ref(false)
const versionEditorVisible = ref(false)
const selectedAgent = ref<AgentDefinition>()
const editingVersion = ref<AgentVersion>()
const versionForm = reactive<AgentVersionCommand>({
  executionMode: 'MODEL_ONLY',
  providerId: undefined,
  modelName: '',
  systemPrompt: '',
  timeoutSeconds: 120,
  failurePolicy: 'FAIL_PROCESS',
  inputSchema: '',
  outputSchema: '',
})
type SchemaField = {
  path: string
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'
  itemType: 'string' | 'number' | 'integer' | 'boolean' | 'object'
  required: boolean
  description: string
}
type InputSchemaNode = {
  type?: string
  description?: string
  required?: string[]
  items?: InputSchemaNode
  properties?: Record<string, InputSchemaNode>
}
const inputSchemaFields = ref<SchemaField[]>([])
const outputSchemaFields = ref<SchemaField[]>([])
const versionsQuery = useQuery({
  queryKey: computed(() => queryKeys.agentVersions(tenantCode.value, selectedAgent.value?.id || 0)),
  queryFn: () => agentApi.versions(selectedAgent.value!.id),
  enabled: computed(() => Boolean(selectedAgent.value?.id && versionDialogVisible.value)),
})
const versions = computed(() => versionsQuery.data.value ?? [])
const hasDraft = computed(() => versions.value.some((item) => item.status === 'DRAFT'))
const createDraftMutation = useMutation({
  mutationFn: () => agentApi.createDraft(selectedAgent.value!.id),
  onSuccess: async (version) => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.agentVersions(tenantCode.value, selectedAgent.value!.id),
    })
    openVersionEditor(version)
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const saveVersionMutation = useMutation({
  mutationFn: () =>
    agentApi.updateDraft(selectedAgent.value!.id, editingVersion.value!.id, {
      ...versionForm,
      modelName: versionForm.modelName?.trim(),
      systemPrompt: versionForm.systemPrompt.trim(),
      inputSchema: buildInputSchema(),
      outputSchema: buildSchema(outputSchemaFields),
    }),
  onSuccess: async () => {
    versionEditorVisible.value = false
    ElMessage.success('Agent 草稿已保存')
    await refreshVersions()
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const publishMutation = useMutation({
  mutationFn: (version: AgentVersion) => agentApi.publish(version.definitionId, version.id),
  onSuccess: async () => {
    ElMessage.success('Agent 版本已发布，配置已锁定')
    await Promise.all([
      refreshVersions(),
      queryClient.invalidateQueries({ queryKey: queryKeys.agents(tenantCode.value) }),
    ])
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

const providerDialogVisible = ref(false)
const editingProviderId = ref<number>()
const providerForm = reactive<AgentProviderCommand>({
  code: '',
  name: '',
  type: 'MOCK',
  baseUrl: '',
  defaultModel: '',
  credential: '',
  enabled: true,
})
const saveProviderMutation = useMutation({
  mutationFn: async () => {
    if (!providerForm.code.trim() || !providerForm.name.trim())
      throw new Error('Provider 编码和名称不能为空')
    const payload = {
      ...providerForm,
      code: providerForm.code.trim(),
      name: providerForm.name.trim(),
      baseUrl: providerForm.baseUrl?.trim(),
      defaultModel: providerForm.defaultModel?.trim(),
      credential: providerForm.credential?.trim(),
    }
    return editingProviderId.value
      ? agentProviderApi.update(editingProviderId.value, payload)
      : agentProviderApi.create(payload)
  },
  onSuccess: async () => {
    providerDialogVisible.value = false
    ElMessage.success(editingProviderId.value ? 'Provider 已更新' : 'Provider 已创建')
    await queryClient.invalidateQueries({ queryKey: queryKeys.agentProviders(tenantCode.value) })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

function searchAgents() {
  agentQuery.pageNum = 1
  appliedAgentQuery.value = { ...agentQuery }
}
function resetAgents() {
  Object.assign(agentQuery, { keyword: '', enabled: undefined, pageNum: 1 })
  appliedAgentQuery.value = { ...agentQuery }
}
function changeAgentPage(pageNum: number, pageSize: number) {
  Object.assign(agentQuery, { pageNum, pageSize })
  appliedAgentQuery.value = { ...agentQuery }
}
function openAgentCreate() {
  editingAgentId.value = undefined
  Object.assign(agentForm, { code: '', name: '', description: '', enabled: true })
  agentDialogVisible.value = true
}
function openAgentEdit(agent: AgentDefinition) {
  editingAgentId.value = agent.id
  Object.assign(agentForm, {
    code: agent.code,
    name: agent.name,
    description: agent.description || '',
    enabled: agent.enabled,
  })
  agentDialogVisible.value = true
}
function openManualRun(agent: AgentDefinition) {
  manualRunAgent.value = agent
  manualRunInput.value = ''
  manualRunDialogVisible.value = true
}
function openVersions(agent: AgentDefinition) {
  selectedAgent.value = agent
  versionDialogVisible.value = true
}
function openVersionEditor(version: AgentVersion) {
  editingVersion.value = version
  Object.assign(versionForm, {
    executionMode: version.executionMode || 'MODEL_ONLY',
    providerId: version.providerId,
    modelName: version.modelName || '',
    systemPrompt: version.systemPrompt || '',
    timeoutSeconds: version.timeoutSeconds,
    failurePolicy: version.failurePolicy,
    inputSchema: version.inputSchema || '',
    outputSchema: version.outputSchema || '',
  })
  inputSchemaFields.value = parseSchema(version.inputSchema)
  outputSchemaFields.value = parseSchema(version.outputSchema)
  versionEditorVisible.value = true
}

function parseSchema(schema?: string): SchemaField[] {
  if (!schema?.trim()) return []
  try {
    const root = JSON.parse(schema) as InputSchemaNode
    const fields: SchemaField[] = []
    const walk = (node: InputSchemaNode, prefix = '') => {
      const properties = node?.properties
      if (!properties || typeof properties !== 'object') return
      const required = new Set(Array.isArray(node.required) ? node.required : [])
      Object.entries(properties).forEach(([name, child]) => {
        const path = prefix ? `${prefix}.${name}` : name
        fields.push({
          path,
          type: ['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(
            child?.type || '',
          )
            ? (child.type as SchemaField['type'])
            : 'string',
          itemType: ['string', 'number', 'integer', 'boolean', 'object'].includes(
            child?.items?.type || '',
          )
            ? (child.items?.type as SchemaField['itemType'])
            : 'string',
          required: required.has(name),
          description: child?.description || '',
        })
        walk(child, path)
      })
    }
    walk(root)
    return fields
  } catch {
    return []
  }
}

function buildInputSchema() {
  return buildSchema(inputSchemaFields)
}

function buildSchema(fieldsRef: { value: SchemaField[] }) {
  const root: InputSchemaNode = { type: 'object', properties: {} }
  fieldsRef.value
    .filter((field) => field.path.trim())
    .forEach((field) => {
      const segments = field.path
        .split('.')
        .map((segment) => segment.trim())
        .filter(Boolean)
      let node = root
      segments.forEach((segment, index) => {
        node.properties ||= {}
        node.properties[segment] ||= { type: index === segments.length - 1 ? field.type : 'object' }
        if (index === segments.length - 1) {
          node.properties[segment].type = field.type
          if (field.description.trim())
            node.properties[segment].description = field.description.trim()
          if (field.required) {
            node.required ||= []
            if (!node.required.includes(segment)) node.required.push(segment)
          }
          if (field.type === 'array') node.properties[segment].items = { type: field.itemType }
        }
        node = node.properties[segment]
      })
    })
  return fieldsRef.value.length ? JSON.stringify(root) : ''
}

function addInputSchemaField() {
  inputSchemaFields.value.push({
    path: '',
    type: 'string',
    itemType: 'string',
    required: false,
    description: '',
  })
}

function addOutputSchemaField() {
  outputSchemaFields.value.push({
    path: '',
    type: 'string',
    itemType: 'string',
    required: false,
    description: '',
  })
}

function removeInputSchemaField(index: number) {
  inputSchemaFields.value.splice(index, 1)
}
async function publishVersion(version: AgentVersion) {
  const confirmed = await confirmAction(
    `发布版本 ${version.version} 后配置将不可修改，后续变更需要创建新版本。是否继续？`,
    '发布 Agent 版本',
    { confirmButtonText: '发布', cancelButtonText: '取消', type: 'warning' },
  )
  if (confirmed) publishMutation.mutate(version)
}
async function refreshVersions() {
  if (!selectedAgent.value) return
  await queryClient.invalidateQueries({
    queryKey: queryKeys.agentVersions(tenantCode.value, selectedAgent.value.id),
  })
}

function searchProviders() {
  providerQuery.pageNum = 1
  appliedProviderQuery.value = { ...providerQuery }
}
function resetProviders() {
  Object.assign(providerQuery, { keyword: '', enabled: undefined, pageNum: 1 })
  appliedProviderQuery.value = { ...providerQuery }
}
function changeProviderPage(pageNum: number, pageSize: number) {
  Object.assign(providerQuery, { pageNum, pageSize })
  appliedProviderQuery.value = { ...providerQuery }
}
function openProviderCreate() {
  editingProviderId.value = undefined
  Object.assign(providerForm, {
    code: '',
    name: '',
    type: 'MOCK',
    baseUrl: '',
    defaultModel: '',
    credential: '',
    enabled: true,
  })
  providerDialogVisible.value = true
}
function openProviderEdit(provider: AgentProvider) {
  editingProviderId.value = provider.id
  Object.assign(providerForm, {
    code: provider.code,
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl || '',
    defaultModel: provider.defaultModel || '',
    credential: '',
    enabled: provider.enabled,
  })
  providerDialogVisible.value = true
}

function searchRuns() {
  runQuery.pageNum = 1
  appliedRunQuery.value = { ...runQuery }
}
function resetRuns() {
  Object.assign(runQuery, { keyword: '', status: undefined, pageNum: 1 })
  appliedRunQuery.value = { ...runQuery }
}
function changeRunPage(pageNum: number, pageSize: number) {
  Object.assign(runQuery, { pageNum, pageSize })
  appliedRunQuery.value = { ...runQuery }
}
function openRunDetail(run: AgentRun) {
  selectedRunId.value = run.id
  runDetailVisible.value = true
}

function providerTypeLabel(type: AgentProviderType) {
  return type === 'MOCK' ? 'Mock（测试）' : 'OpenAI 兼容'
}
function failurePolicyLabel(policy: AgentFailurePolicy) {
  return { FAIL_PROCESS: '终止流程', CONTINUE_EMPTY: '空结果继续', MANUAL_REVIEW: '转人工处理' }[
    policy
  ]
}
function snapshotField(snapshot: string | undefined, field: string) {
  if (!snapshot) return ''
  try {
    const value = JSON.parse(snapshot) as Record<string, unknown>
    return typeof value[field] === 'string' ? value[field] : JSON.stringify(value[field] ?? '')
  } catch {
    return snapshot
  }
}
</script>

<template>
  <div class="management-page page-stack agent-management-page">
    <PageHeader
      eyebrow="Agent Runtime"
      title="Agent 中心"
      description="管理租户级 Agent、不可变版本和模型 Provider，并追踪每一次可靠执行。"
    />

    <section class="agent-overview">
      <div>
        <span class="overview-icon"><Bot :size="19" /></span>
        <p><strong>定义与版本</strong><small>配置提示词、模型和失败策略</small></p>
      </div>
      <div>
        <span class="overview-icon tone-purple"><ServerCog :size="19" /></span>
        <p><strong>Provider</strong><small>隔离地址、模型与加密凭证</small></p>
      </div>
      <div>
        <span class="overview-icon tone-green"><CirclePlay :size="19" /></span>
        <p><strong>运行记录</strong><small>查看状态、流程关联与错误分类</small></p>
      </div>
      <div>
        <span class="overview-icon tone-amber"><ShieldCheck :size="19" /></span>
        <p><strong>安全边界</strong><small>密钥不回显，所有数据按租户隔离</small></p>
      </div>
    </section>

    <section class="agent-workspace">
      <el-tabs v-model="activeTab" class="agent-tabs">
        <el-tab-pane v-if="canManageAgents" label="Agent 定义" name="agents">
          <div class="agent-tab-content">
            <section class="page-actions compact-filter">
              <el-form class="filter-form filter-form--agent" inline @submit.prevent="searchAgents">
                <el-form-item label="关键词"
                  ><el-input v-model="agentQuery.keyword" clearable placeholder="Agent 编码或名称"
                /></el-form-item>
                <el-form-item label="状态"
                  ><el-select v-model="agentQuery.enabled" clearable
                    ><el-option label="启用" :value="true" /><el-option
                      label="禁用"
                      :value="false" /></el-select
                ></el-form-item>
                <el-form-item class="filter-form__actions"
                  ><el-button type="primary" native-type="submit"
                    ><Search :size="16" />查询</el-button
                  ><el-button @click="resetAgents"
                    ><RefreshCw :size="16" />重置</el-button
                  ></el-form-item
                >
              </el-form>
              <el-button class="page-primary-action" type="primary" @click="openAgentCreate"
                ><Plus :size="17" />新建 Agent</el-button
              >
            </section>
            <section class="agent-table-panel table-panel">
              <el-table
                v-loading="agentsQuery.isFetching.value"
                :data="agentsQuery.data.value?.records ?? []"
                height="100%"
              >
                <el-table-column label="Agent" min-width="230"
                  ><template #default="{ row }"
                    ><div class="agent-name-cell">
                      <span>{{ row.name.slice(0, 1).toUpperCase() }}</span>
                      <p>
                        <strong>{{ row.name }}</strong
                        ><small>{{ row.code }}</small>
                      </p>
                    </div></template
                  ></el-table-column
                >
                <el-table-column label="已发布版本" width="125" header-align="center"
                  ><template #default="{ row }"
                    ><TableTagCell>
                      <StatusBadge
                        class="version-status-badge"
                        v-if="row.publishedVersion"
                        status="PUBLISHED"
                        :label="formatVersion(row.publishedVersion)"
                      />
                      <span v-else>—</span>
                    </TableTagCell>
                  </template></el-table-column
                >
                <el-table-column label="草稿版本" width="125" header-align="center"
                  ><template #default="{ row }"
                    ><TableTagCell>
                      <StatusBadge
                        class="version-status-badge"
                        v-if="row.latestVersion && row.latestVersion !== row.publishedVersion"
                        status="DRAFT"
                        :label="formatVersion(row.latestVersion)"
                      />
                      <span v-else>—</span>
                    </TableTagCell>
                  </template></el-table-column
                >
                <el-table-column
                  prop="description"
                  label="说明"
                  min-width="240"
                  show-overflow-tooltip
                />
                <el-table-column
                  class-name="agent-status-column"
                  label="状态"
                  width="110"
                  align="center"
                  header-align="center"
                  ><template #default="{ row }"><StatusBadge :status="row.enabled" /></template
                ></el-table-column>
                <el-table-column label="更新时间" width="175"
                  ><template #default="{ row }">{{
                    formatDateTime(row.updatedAt)
                  }}</template></el-table-column
                >
                <el-table-column label="操作" width="260" fixed="right"
                  ><template #default="{ row }"
                    ><el-button
                      v-if="canExecuteRuns"
                      link
                      type="primary"
                      :disabled="!row.publishedVersion || !row.enabled"
                      @click="openManualRun(row)"
                      >测试运行</el-button
                    ><el-button link type="primary" @click="openVersions(row)">版本管理</el-button
                    ><el-button link type="primary" @click="openAgentEdit(row)"
                      >编辑</el-button
                    ></template
                  ></el-table-column
                >
                <template #empty
                  ><ListEmptyState
                    title="尚未创建 Agent"
                    description="先创建 Agent，再配置并发布第一个版本。"
                    :icon="Bot"
                /></template>
              </el-table>
              <el-pagination
                v-accessible-label="'每页条数'"
                aria-label="Agent 定义分页"
                class="table-pagination"
                v-model:current-page="agentQuery.pageNum"
                v-model:page-size="agentQuery.pageSize"
                :total="agentsQuery.data.value?.total ?? 0"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next"
                @change="changeAgentPage"
              />
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="canManageAgents" label="Provider 配置" name="providers">
          <div class="agent-tab-content">
            <section class="page-actions compact-filter">
              <el-form
                class="filter-form filter-form--agent"
                inline
                @submit.prevent="searchProviders"
              >
                <el-form-item label="关键词"
                  ><el-input
                    v-model="providerQuery.keyword"
                    clearable
                    placeholder="Provider 编码或名称"
                /></el-form-item>
                <el-form-item label="状态"
                  ><el-select v-model="providerQuery.enabled" clearable
                    ><el-option label="启用" :value="true" /><el-option
                      label="禁用"
                      :value="false" /></el-select
                ></el-form-item>
                <el-form-item class="filter-form__actions"
                  ><el-button type="primary" native-type="submit"
                    ><Search :size="16" />查询</el-button
                  ><el-button @click="resetProviders"
                    ><RefreshCw :size="16" />重置</el-button
                  ></el-form-item
                >
              </el-form>
              <el-button class="page-primary-action" type="primary" @click="openProviderCreate"
                ><Plus :size="17" />新建 Provider</el-button
              >
            </section>
            <section class="agent-table-panel table-panel">
              <el-table
                class="provider-table"
                v-loading="providersQuery.isFetching.value"
                :data="providersQuery.data.value?.records ?? []"
                height="100%"
              >
                <el-table-column prop="name" label="Provider 名称" min-width="180" />
                <el-table-column prop="code" label="编码" min-width="150" />
                <el-table-column label="类型" width="140"
                  ><template #default="{ row }">{{
                    providerTypeLabel(row.type)
                  }}</template></el-table-column
                >
                <el-table-column
                  prop="baseUrl"
                  label="API 地址"
                  min-width="230"
                  show-overflow-tooltip
                  ><template #default="{ row }">{{
                    row.baseUrl || '本地 Mock'
                  }}</template></el-table-column
                >
                <el-table-column prop="defaultModel" label="默认模型" min-width="150"
                  ><template #default="{ row }">{{
                    row.defaultModel || '—'
                  }}</template></el-table-column
                >
                <el-table-column label="凭证" width="145" align="center" header-align="center"
                  ><template #default="{ row }"
                    ><div class="credential-status">
                      <StatusBadge
                        :status="
                          row.credentialConfigured
                            ? 'SUCCESS'
                            : row.type === 'MOCK'
                              ? 'SKIPPED'
                              : 'PENDING'
                        "
                        :tone="
                          row.credentialConfigured
                            ? 'primary'
                            : row.type === 'MOCK'
                              ? 'info'
                              : 'warning'
                        "
                        :label="
                          row.credentialConfigured
                            ? '已配置'
                            : row.type === 'MOCK'
                              ? '无需凭证'
                              : '未配置'
                        "
                      />
                      <small v-if="row.credentialConfigured && row.credentialHint">
                        尾号 {{ row.credentialHint }}
                      </small>
                    </div></template
                  ></el-table-column
                >
                <el-table-column
                  class-name="agent-status-column"
                  label="状态"
                  width="110"
                  align="center"
                  header-align="center"
                  ><template #default="{ row }"><StatusBadge :status="row.enabled" /></template
                ></el-table-column>
                <el-table-column label="操作" width="90" fixed="right"
                  ><template #default="{ row }"
                    ><el-button link type="primary" @click="openProviderEdit(row)"
                      >编辑</el-button
                    ></template
                  ></el-table-column
                >
                <template #empty
                  ><ListEmptyState
                    title="尚未配置 Provider"
                    description="先配置模型服务与凭据，再创建可发布的 Agent 版本。"
                    :icon="ServerCog"
                /></template>
              </el-table>
              <el-pagination
                v-accessible-label="'每页条数'"
                aria-label="Provider 分页"
                class="table-pagination"
                v-model:current-page="providerQuery.pageNum"
                v-model:page-size="providerQuery.pageSize"
                :total="providersQuery.data.value?.total ?? 0"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next"
                @change="changeProviderPage"
              />
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="canReadRuns" label="运行记录" name="runs">
          <div class="agent-tab-content">
            <section class="page-actions compact-filter">
              <el-form class="filter-form filter-form--agent" inline @submit.prevent="searchRuns">
                <el-form-item label="关键词"
                  ><el-input v-model="runQuery.keyword" clearable placeholder="Agent、流程实例"
                /></el-form-item>
                <el-form-item label="状态"
                  ><el-select v-model="runQuery.status" clearable
                    ><el-option
                      v-for="status in agentRunStatuses"
                      :key="status"
                      :label="getStatusLabel(status)"
                      :value="status" /></el-select
                ></el-form-item>
                <el-form-item class="filter-form__actions"
                  ><el-button type="primary" native-type="submit"
                    ><Search :size="16" />查询</el-button
                  ><el-button @click="resetRuns"
                    ><RefreshCw :size="16" />重置</el-button
                  ></el-form-item
                >
              </el-form>
            </section>
            <section class="agent-table-panel table-panel">
              <el-table
                class="agent-run-table"
                v-loading="runsQuery.isFetching.value"
                :data="runsQuery.data.value?.records ?? []"
                height="100%"
              >
                <el-table-column label="运行编号" width="110"
                  ><template #default="{ row }">#{{ row.id }}</template></el-table-column
                >
                <el-table-column label="Agent" min-width="190"
                  ><template #default="{ row }"
                    ><strong>{{ row.agentName }}</strong>
                    <div class="cell-secondary">
                      {{ row.agentCode }} · 版本 {{ row.agentVersion }}
                    </div></template
                  ></el-table-column
                >
                <el-table-column label="状态" width="115" align="center" header-align="center"
                  ><template #default="{ row }"><StatusBadge :status="row.status" /></template
                ></el-table-column>
                <el-table-column prop="processInstanceId" label="流程实例" min-width="180"
                  ><template #default="{ row }">{{
                    row.processInstanceId || '—'
                  }}</template></el-table-column
                >
                <el-table-column prop="activityId" label="流程节点" min-width="150"
                  ><template #default="{ row }">{{
                    row.activityId || '—'
                  }}</template></el-table-column
                >
                <el-table-column prop="errorCode" label="错误分类" min-width="150"
                  ><template #default="{ row }">{{
                    row.errorCode || '—'
                  }}</template></el-table-column
                >
                <el-table-column label="创建时间" width="175"
                  ><template #default="{ row }">{{
                    formatDateTime(row.createdAt)
                  }}</template></el-table-column
                >
                <el-table-column label="操作" width="90" fixed="right"
                  ><template #default="{ row }"
                    ><el-button link type="primary" @click="openRunDetail(row)"
                      >详情</el-button
                    ></template
                  ></el-table-column
                >
                <template #empty
                  ><ListEmptyState
                    title="暂无运行记录"
                    description="测试运行或流程节点执行后，会在这里留下完整审计记录。"
                    :icon="CirclePlay"
                /></template>
              </el-table>
              <el-pagination
                v-accessible-label="'每页条数'"
                aria-label="运行记录分页"
                class="table-pagination"
                v-model:current-page="runQuery.pageNum"
                v-model:page-size="runQuery.pageSize"
                :total="runsQuery.data.value?.total ?? 0"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next"
                @change="changeRunPage"
              />
            </section>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="manualRunDialogVisible"
      :title="`测试运行 · ${manualRunAgent?.name || ''}`"
      width="620px"
      destroy-on-close
    >
      <div class="manual-run-intro">
        <CirclePlay :size="20" />
        <p>
          <strong>执行已发布版本</strong>
          <span>本次请求会创建正式 AgentRun，并记录 Attempt、模型调用和状态历史。</span>
        </p>
      </div>
      <el-form label-position="top">
        <el-form-item label="测试输入" required>
          <el-input
            v-model="manualRunInput"
            type="textarea"
            :rows="7"
            maxlength="20000"
            show-word-limit
            placeholder="输入一段真实业务内容，用于验证 Prompt 和模型响应"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualRunDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!manualRunInput.trim()"
          :loading="submitManualRunMutation.isPending.value"
          @click="submitManualRunMutation.mutate()"
        >
          <CirclePlay :size="16" />开始测试
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="runDetailVisible"
      :title="`运行详情 #${selectedRunId || ''}`"
      size="min(880px, 100vw)"
    >
      <div v-loading="runDetailQuery.isFetching.value" class="run-detail">
        <template v-if="runDetailQuery.data.value">
          <section class="run-summary-card">
            <div>
              <small>Agent</small>
              <strong>{{ runDetailQuery.data.value.run.agentName }}</strong>
              <span class="run-summary-card__meta"
                >{{ runDetailQuery.data.value.run.agentCode }} · 版本
                {{ runDetailQuery.data.value.run.agentVersion }}</span
              >
            </div>
            <div class="run-status-summary">
              <small>执行状态</small>
              <StatusBadge :status="runDetailQuery.data.value.run.status" />
            </div>
            <div>
              <small>关联流程</small>
              <strong>{{ runDetailQuery.data.value.run.processInstanceId || '未关联' }}</strong>
              <span class="run-summary-card__meta">{{
                runDetailQuery.data.value.run.activityId || '—'
              }}</span>
            </div>
          </section>

          <section
            v-if="
              runDetailQuery.data.value.payload.outputSnapshotJson ||
              runDetailQuery.data.value.run.errorCode
            "
            class="run-result-card"
          >
            <small>执行结果</small>
            <pre v-if="runDetailQuery.data.value.payload.outputSnapshotJson">{{
              snapshotField(runDetailQuery.data.value.payload.outputSnapshotJson, 'content')
            }}</pre>
            <el-alert
              v-else
              :type="
                getAgentErrorPresentation(runDetailQuery.data.value.run.errorCode)?.action ===
                'CONFIGURATION'
                  ? 'warning'
                  : 'error'
              "
              :closable="false"
            >
              <template #title>
                <span class="run-error-title">
                  {{
                    getAgentErrorPresentation(runDetailQuery.data.value.run.errorCode)?.title ||
                    'Agent 执行未完成'
                  }}
                </span>
              </template>
              <div class="run-error-detail">
                <span>
                  {{
                    getAgentErrorPresentation(runDetailQuery.data.value.run.errorCode)
                      ?.description || '系统已记录本次失败，请联系管理员。'
                  }}
                </span>
                <span class="run-error-action">
                  {{
                    getAgentErrorPresentation(runDetailQuery.data.value.run.errorCode)?.actionLabel
                  }}
                  · {{ runDetailQuery.data.value.run.errorCode }}
                </span>
              </div>
            </el-alert>
          </section>

          <el-tabs class="run-detail-tabs">
            <el-tab-pane label="输入与输出">
              <div class="run-payload-grid">
                <article>
                  <strong>测试输入</strong>
                  <pre>{{
                    snapshotField(runDetailQuery.data.value.payload.inputSnapshotJson, 'input') ||
                    '—'
                  }}</pre>
                </article>
                <article>
                  <strong>模型输出</strong>
                  <pre>{{
                    snapshotField(
                      runDetailQuery.data.value.payload.outputSnapshotJson,
                      'content',
                    ) || '等待执行结果'
                  }}</pre>
                </article>
              </div>
            </el-tab-pane>
            <el-tab-pane :label="`执行尝试 (${runDetailQuery.data.value.attempts.length})`">
              <el-table :data="runDetailQuery.data.value.attempts" size="small">
                <el-table-column prop="attemptNo" label="次数" width="70" />
                <el-table-column label="状态" width="110">
                  <template #default="{ row }"><StatusBadge :status="row.status" /></template>
                </el-table-column>
                <el-table-column prop="errorCode" label="错误分类" min-width="140">
                  <template #default="{ row }">{{ row.errorCode || '—' }}</template>
                </el-table-column>
                <el-table-column label="开始时间" width="175">
                  <template #default="{ row }">{{ formatDateTime(row.startedAt) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="`模型调用 (${runDetailQuery.data.value.modelInvocations.length})`">
              <el-table :data="runDetailQuery.data.value.modelInvocations" size="small">
                <el-table-column prop="providerName" label="Provider" min-width="130" />
                <el-table-column prop="actualModel" label="实际模型" min-width="150">
                  <template #default="{ row }">{{
                    row.actualModel || row.requestedModel
                  }}</template>
                </el-table-column>
                <el-table-column label="状态" width="105">
                  <template #default="{ row }"><StatusBadge :status="row.status" /></template>
                </el-table-column>
                <el-table-column label="Token" width="115">
                  <template #default="{ row }"
                    >{{ row.inputTokens }} / {{ row.outputTokens }}</template
                  >
                </el-table-column>
                <el-table-column label="耗时" width="100">
                  <template #default="{ row }">{{ row.latencyMillis ?? '—' }} ms</template>
                </el-table-column>
                <el-table-column prop="errorCode" label="错误分类" min-width="160">
                  <template #default="{ row }">{{ row.errorCode || '—' }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="`执行步骤 (${runDetailQuery.data.value.steps.length})`">
              <el-table :data="runDetailQuery.data.value.steps" size="small">
                <el-table-column prop="sequenceNo" label="序号" width="70" />
                <el-table-column prop="stepType" label="步骤类型" min-width="150" />
                <el-table-column label="状态" width="110">
                  <template #default="{ row }"><StatusBadge :status="row.status" /></template>
                </el-table-column>
                <el-table-column prop="errorCode" label="错误分类" min-width="140">
                  <template #default="{ row }">{{ row.errorCode || '—' }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="`检查点 (${runDetailQuery.data.value.checkpoints.length})`">
              <div v-if="runDetailQuery.data.value.checkpoints.length" class="checkpoint-list">
                <article
                  v-for="checkpoint in runDetailQuery.data.value.checkpoints"
                  :key="checkpoint.id"
                >
                  <header>
                    <strong>#{{ checkpoint.sequenceNo }} {{ checkpoint.checkpointType }}</strong>
                    <span>{{ formatDateTime(checkpoint.createdAt) }}</span>
                  </header>
                  <pre>{{ checkpoint.snapshotJson }}</pre>
                </article>
              </div>
              <ListEmptyState
                v-else
                compact
                title="暂无检查点"
                description="本次运行尚未生成恢复检查点。"
              />
            </el-tab-pane>
            <el-tab-pane :label="`状态历史 (${runDetailQuery.data.value.stateHistory.length})`">
              <div v-if="runDetailQuery.data.value.stateHistory.length" class="state-history-panel">
                <div class="state-history-guide">
                  <strong>状态演进</strong>
                  <span>按时间从早到晚 · 上 → 下</span>
                </div>
                <el-timeline class="state-history-timeline">
                  <el-timeline-item
                    v-for="history in runDetailQuery.data.value.stateHistory"
                    :key="history.id"
                    :timestamp="formatDateTime(history.createdAt)"
                  >
                    <div class="state-transition">
                      <StatusBadge :status="history.oldStatus" />
                      <span>→</span>
                      <StatusBadge :status="history.newStatus" />
                    </div>
                    <p>
                      {{ history.reasonCode }} · {{ history.operatorType }} /
                      {{ history.operatorId }}
                    </p>
                    <small>Trace ID：{{ history.traceId }}</small>
                  </el-timeline-item>
                </el-timeline>
              </div>
              <ListEmptyState
                v-else
                compact
                title="暂无状态变更"
                description="运行状态变化后会记录在这里。"
              />
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
    </el-drawer>

    <el-dialog
      v-model="agentDialogVisible"
      :title="editingAgentId ? '编辑 Agent' : '新建 Agent'"
      width="560px"
    >
      <el-form class="dialog-form" label-position="top">
        <el-form-item label="Agent 编码" required
          ><el-input
            v-model="agentForm.code"
            :disabled="Boolean(editingAgentId)"
            maxlength="64"
            placeholder="例如 expense_review"
        /></el-form-item>
        <el-form-item label="Agent 名称" required
          ><el-input v-model="agentForm.name" maxlength="128" placeholder="面向业务用户的名称"
        /></el-form-item>
        <el-form-item label="说明"
          ><el-input
            v-model="agentForm.description"
            type="textarea"
            :rows="3"
            maxlength="512"
            show-word-limit
        /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="agentForm.enabled" /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="agentDialogVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="saveAgentMutation.isPending.value"
          @click="saveAgentMutation.mutate()"
          >保存</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="providerDialogVisible"
      :title="editingProviderId ? '编辑 Provider' : '新建 Provider'"
      width="620px"
    >
      <el-form class="dialog-form" label-position="top">
        <div class="agent-form-grid">
          <el-form-item label="Provider 编码" required
            ><el-input
              v-model="providerForm.code"
              :disabled="Boolean(editingProviderId)"
              maxlength="64"
              placeholder="例如 mock_local" /></el-form-item
          ><el-form-item label="Provider 名称" required
            ><el-input v-model="providerForm.name" maxlength="128"
          /></el-form-item>
        </div>
        <el-form-item label="Provider 类型" required
          ><el-radio-group v-model="providerForm.type"
            ><el-radio-button value="MOCK">Mock（测试）</el-radio-button
            ><el-radio-button value="OPENAI_COMPATIBLE"
              >OpenAI 兼容</el-radio-button
            ></el-radio-group
          ></el-form-item
        >
        <template v-if="providerForm.type === 'OPENAI_COMPATIBLE'">
          <el-form-item label="API Base URL" required
            ><el-input v-model="providerForm.baseUrl" placeholder="https://api.example.com/v1"
          /></el-form-item>
          <el-form-item label="默认模型"
            ><el-input v-model="providerForm.defaultModel" placeholder="例如 gpt-5-mini"
          /></el-form-item>
          <el-form-item :label="editingProviderId ? '更换 API Key' : 'API Key'"
            ><el-input
              v-model="providerForm.credential"
              type="password"
              show-password
              autocomplete="new-password"
              :placeholder="editingProviderId ? '留空表示保留现有凭证' : '密钥将由后端加密保存'"
            />
            <div class="form-help">
              保存后前端无法读取明文，只显示是否已配置和末四位提示。
            </div></el-form-item
          >
        </template>
        <el-form-item label="启用"><el-switch v-model="providerForm.enabled" /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="providerDialogVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="saveProviderMutation.isPending.value"
          @click="saveProviderMutation.mutate()"
          >保存</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="versionDialogVisible"
      :title="`${selectedAgent?.name || ''} · 版本管理`"
      width="880px"
    >
      <div class="version-toolbar">
        <p>已发布版本不可修改；调整提示词、模型或策略时创建新草稿。</p>
        <el-button
          type="primary"
          :disabled="hasDraft"
          :loading="createDraftMutation.isPending.value"
          @click="createDraftMutation.mutate()"
          ><Plus :size="16" />创建新版本</el-button
        >
      </div>
      <el-table v-loading="versionsQuery.isFetching.value" :data="versions">
        <el-table-column label="版本" width="100"
          ><template #default="{ row }"
            ><strong>{{ formatVersion(row.version) }}</strong></template
          ></el-table-column
        >
        <el-table-column label="状态" width="105"
          ><template #default="{ row }"><StatusBadge :status="row.status" /></template
        ></el-table-column>
        <el-table-column prop="providerName" label="Provider" min-width="150"
          ><template #default="{ row }">{{
            row.providerName || '未配置'
          }}</template></el-table-column
        >
        <el-table-column prop="modelName" label="模型" min-width="140"
          ><template #default="{ row }">{{
            row.modelName || '使用默认模型'
          }}</template></el-table-column
        >
        <el-table-column label="失败策略" width="120"
          ><template #default="{ row }">{{
            failurePolicyLabel(row.failurePolicy)
          }}</template></el-table-column
        >
        <el-table-column label="发布时间" width="175"
          ><template #default="{ row }">{{
            formatDateTime(row.publishedAt)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="150" fixed="right"
          ><template #default="{ row }"
            ><el-button
              v-if="row.status === 'DRAFT'"
              link
              type="primary"
              @click="openVersionEditor(row)"
              >配置</el-button
            ><el-button
              v-if="row.status === 'DRAFT'"
              link
              type="success"
              @click="publishVersion(row)"
              >发布</el-button
            ><el-button v-else link type="primary" @click="openVersionEditor(row)"
              >查看</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </el-dialog>

    <el-dialog
      v-model="versionEditorVisible"
      :title="`Agent 版本 ${editingVersion?.version || ''}`"
      width="760px"
    >
      <el-form class="dialog-form" label-position="top">
        <el-alert
          v-if="editingVersion?.status === 'PUBLISHED'"
          title="这是不可变的已发布版本，只能查看。"
          type="info"
          :closable="false"
          show-icon
        />
        <el-form-item label="执行方式" required>
          <el-select
            v-model="versionForm.executionMode"
            :disabled="editingVersion?.status === 'PUBLISHED'"
          >
            <el-option label="模型调用（MODEL_ONLY）" value="MODEL_ONLY" />
            <el-option label="平台 Agent（受控工具循环）" value="PLATFORM_AGENT" />
            <el-option label="远程 Agent（规划中）" value="REMOTE_AGENT" disabled />
          </el-select>
          <div class="form-help">执行方式属于版本语义，发布后不可修改。</div>
        </el-form-item>
        <div class="agent-form-grid">
          <el-form-item label="Provider" required
            ><el-select
              v-model="versionForm.providerId"
              filterable
              placeholder="选择当前租户的 Provider"
              :disabled="editingVersion?.status === 'PUBLISHED'"
              ><el-option
                v-for="provider in enabledProvidersQuery.data.value ?? []"
                :key="provider.id"
                :label="`${provider.name} · ${providerTypeLabel(provider.type)}`"
                :value="provider.id" /></el-select></el-form-item
          ><el-form-item label="模型"
            ><el-input
              v-model="versionForm.modelName"
              :disabled="editingVersion?.status === 'PUBLISHED'"
              placeholder="留空使用 Provider 默认模型"
          /></el-form-item>
        </div>
        <el-form-item label="系统提示词" required
          ><el-input
            v-model="versionForm.systemPrompt"
            type="textarea"
            :rows="8"
            maxlength="20000"
            show-word-limit
            :disabled="editingVersion?.status === 'PUBLISHED'"
            placeholder="定义 Agent 的职责、边界、输入和输出要求"
        /></el-form-item>
        <div class="agent-form-grid">
          <el-form-item label="Agent 运行超时（秒）" required
            ><el-input-number
              v-model="versionForm.timeoutSeconds"
              :min="1"
              :max="3600"
              :disabled="editingVersion?.status === 'PUBLISHED'" /></el-form-item
          ><el-form-item label="Agent 运行失败策略" required
            ><el-select
              v-model="versionForm.failurePolicy"
              :disabled="editingVersion?.status === 'PUBLISHED'"
              ><el-option label="运行失败" value="FAIL_PROCESS" /><el-option
                label="空结果继续"
                value="CONTINUE_EMPTY" /><el-option
                label="转人工处理"
                value="MANUAL_REVIEW" /></el-select
          ></el-form-item>
        </div>
        <el-form-item label="Agent 输入字段">
          <div class="schema-editor">
            <div class="schema-editor__toolbar">
              <span>配置业务输入字段，保存时自动生成 JSON Schema</span>
              <el-button
                link
                type="primary"
                :disabled="editingVersion?.status === 'PUBLISHED'"
                @click="addInputSchemaField"
                ><Plus :size="15" />新增字段</el-button
              >
            </div>
            <el-table :data="inputSchemaFields" size="small" border>
              <el-table-column label="字段路径" min-width="180">
                <template #default="{ row }">
                  <el-input v-model="row.path" placeholder="例如 customer.name" />
                </template>
              </el-table-column>
              <el-table-column label="类型" width="130">
                <template #default="{ row }">
                  <el-select v-model="row.type">
                    <el-option label="文本" value="string" />
                    <el-option label="数字" value="number" />
                    <el-option label="整数" value="integer" />
                    <el-option label="布尔值" value="boolean" />
                    <el-option label="对象" value="object" />
                    <el-option label="数组" value="array" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="数组元素" width="130">
                <template #default="{ row }">
                  <el-select v-model="row.itemType" :disabled="row.type !== 'array'">
                    <el-option label="文本" value="string" />
                    <el-option label="数字" value="number" />
                    <el-option label="整数" value="integer" />
                    <el-option label="布尔值" value="boolean" />
                    <el-option label="对象" value="object" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="必填" width="75" align="center">
                <template #default="{ row }"><el-checkbox v-model="row.required" /></template>
              </el-table-column>
              <el-table-column label="说明" min-width="150">
                <template #default="{ row }"><el-input v-model="row.description" /></template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{ $index }">
                  <el-button link type="danger" @click="removeInputSchemaField($index)"
                    >删除</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
            <div v-if="!inputSchemaFields.length" class="schema-editor__empty">
              暂未配置输入字段，Agent 将接收空对象或由流程映射提供的数据。
            </div>
          </div>
          <div class="form-help">
            对象或嵌套字段使用点号路径，例如
            customer.name；数组填写字段路径并选择数组元素类型。流程节点通过输入映射提供数据，平台变量不会自动传入。
          </div>
        </el-form-item>
        <el-form-item label="Agent 输出字段">
          <div class="schema-editor">
            <div class="schema-editor__toolbar">
              <span>配置模型输出字段，保存时自动生成 JSON Schema</span>
              <el-button
                link
                type="primary"
                :disabled="editingVersion?.status === 'PUBLISHED'"
                @click="addOutputSchemaField"
                ><Plus :size="15" />新增字段</el-button
              >
            </div>
            <el-table :data="outputSchemaFields" size="small" border>
              <el-table-column label="字段路径" min-width="180">
                <template #default="{ row }">
                  <el-input v-model="row.path" placeholder="例如 result.summary" />
                </template>
              </el-table-column>
              <el-table-column label="类型" width="130">
                <template #default="{ row }">
                  <el-select v-model="row.type">
                    <el-option label="文本" value="string" />
                    <el-option label="数字" value="number" />
                    <el-option label="整数" value="integer" />
                    <el-option label="布尔值" value="boolean" />
                    <el-option label="对象" value="object" />
                    <el-option label="数组" value="array" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="数组元素" width="130">
                <template #default="{ row }">
                  <el-select v-model="row.itemType" :disabled="row.type !== 'array'">
                    <el-option label="文本" value="string" />
                    <el-option label="数字" value="number" />
                    <el-option label="整数" value="integer" />
                    <el-option label="布尔值" value="boolean" />
                    <el-option label="对象" value="object" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="必填" width="75" align="center">
                <template #default="{ row }"><el-checkbox v-model="row.required" /></template>
              </el-table-column>
              <el-table-column label="说明" min-width="150">
                <template #default="{ row }"><el-input v-model="row.description" /></template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{ $index }">
                  <el-button link type="danger" @click="outputSchemaFields.splice($index, 1)"
                    >删除</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
            <div v-if="!outputSchemaFields.length" class="schema-editor__empty">
              暂未配置输出字段，Agent 输出将不做结构化字段约束。
            </div>
          </div>
          <div class="form-help">
            对象或嵌套字段使用点号路径，例如
            customer.name；数组填写字段路径并选择数组元素类型，保存后仍以 JSON Schema 持久化。
          </div>
        </el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="versionEditorVisible = false">关闭</el-button
        ><el-button
          v-if="editingVersion?.status === 'DRAFT'"
          type="primary"
          :loading="saveVersionMutation.isPending.value"
          @click="saveVersionMutation.mutate()"
          >保存草稿</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>

<style scoped>
.agent-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.schema-editor {
  width: 100%;
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  padding: 10px;
  background: #fbfcfe;
}
.schema-editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #6d7f99;
  font-size: 12px;
}
.schema-editor__empty {
  padding: 16px 10px 6px;
  color: #9aa9bd;
  text-align: center;
  font-size: 12px;
}
.agent-overview > div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid #dfe7f2;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
}
.agent-overview p,
.agent-name-cell p {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
}
.agent-overview strong {
  color: #172033;
  font-size: 13px;
}
.agent-overview small,
.agent-name-cell small,
.cell-secondary {
  color: var(--color-text-subtle);
  font-size: 11px;
}
.overview-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: var(--color-primary);
  background: #eaf2ff;
}
.overview-icon.tone-purple {
  color: #7c3aed;
  background: #f2ebff;
}
.overview-icon.tone-green {
  color: #059669;
  background: #e8faf3;
}
.overview-icon.tone-amber {
  color: #d97706;
  background: #fff5df;
}
.agent-workspace {
  height: clamp(560px, calc(100vh - 280px), 760px);
  min-height: 560px;
  overflow: hidden;
  border: 1px solid #dfe7f2;
  border-radius: 16px;
  background: var(--color-surface);
}
.agent-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.agent-tabs :deep(.el-tabs__content) {
  min-height: 0;
  flex: 1;
}
.agent-tabs :deep(.el-tab-pane) {
  height: 100%;
}
.agent-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 20px;
  background: #fbfcfe;
}
.agent-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #e7edf5;
}
.agent-tabs :deep(.el-tabs__item) {
  height: 52px;
  font-weight: 650;
}
.agent-tab-content {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  padding: 16px;
}
.agent-tab-content .page-actions {
  border: 1px solid var(--color-border-soft);
  border-radius: 13px;
  background: #fbfcfe;
}
.filter-form--agent {
  flex: 1;
  grid-template-columns: minmax(220px, 1fr) minmax(150px, 0.55fr) max-content !important;
  align-items: center;
}
.filter-form--agent > .el-form-item:not(.filter-form__actions) {
  align-items: center;
}
.filter-form--agent > .el-form-item:not(.filter-form__actions) .el-form-item__label {
  min-width: 48px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  line-height: 1.4;
}
.filter-form--agent > .el-form-item:not(.filter-form__actions) .el-form-item__content {
  height: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
}
.agent-table-panel {
  min-height: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: 13px;
  box-shadow: none;
}
.agent-table-panel .table-pagination {
  justify-content: flex-end;
  padding: 12px 14px;
  border-top: 1px solid #edf1f6;
}
.agent-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.agent-name-cell > span {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-weight: 750;
}
.version-status-badge {
  width: 88px;
  min-width: 88px;
}
.agent-table-panel :deep(.agent-status-column .cell) {
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}
.provider-table :deep(td.el-table__cell) {
  height: 66px;
}
.credential-status {
  height: 44px;
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 4px;
}
.provider-status-cell {
  display: flex;
  align-items: flex-start;
  height: 44px;
}
.credential-status small {
  color: #8492a6;
  font-size: 11px;
  line-height: 1;
}
.agent-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
.manual-run-intro {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 18px;
  padding: 13px 14px;
  border: 1px solid #dbe8fb;
  border-radius: 12px;
  color: var(--color-primary);
  background: #f3f7ff;
}
.manual-run-intro p {
  display: grid;
  gap: 3px;
  margin: 0;
}
.state-transition {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.run-status-summary {
  gap: 8px !important;
}
.state-history-panel {
  margin-top: 12px;
  padding: 16px 12px 8px;
  border: 1px solid #e4eaf2;
  border-radius: 12px;
  background: #fbfdff;
}
.state-history-guide {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 4px 16px;
  color: #526176;
  font-size: 12px;
}
.state-history-guide strong {
  color: #24324a;
  font-size: 13px;
}
.state-history-guide span {
  color: #8492a6;
}
.state-history-timeline {
  padding: 4px 8px 0;
}
.state-history-timeline :deep(.el-timeline-item:first-child) {
  padding-top: 4px;
}
.state-history-timeline :deep(.el-timeline-item__content) {
  color: #526176;
}
.manual-run-intro span {
  color: #66758b;
  font-size: 12px;
  line-height: 1.55;
}
.form-help {
  margin-top: 6px;
  color: var(--color-text-subtle);
  font-size: 12px;
  line-height: 1.6;
}
.run-detail {
  min-height: 280px;
}
.run-summary-card {
  display: grid;
  grid-template-columns: 1.3fr 0.75fr 1.1fr;
  gap: 22px;
  padding: 18px 20px;
  border: 1px solid var(--color-border);
  border-radius: 13px;
  background: var(--color-surface-muted);
}
.run-summary-card > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}
.run-summary-card small,
.run-summary-card__meta,
.el-timeline-item small {
  color: #7a889d;
  font-size: 12px;
}
.run-summary-card strong,
.run-summary-card__meta {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.run-result-card {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding: 15px;
  border: 1px solid #dce7f5;
  border-radius: 13px;
  background: #fbfdff;
}
.run-result-card small {
  color: #66758b;
  font-weight: 650;
}
.run-result-card pre,
.run-payload-grid pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  border-radius: 9px;
  color: #24324a;
  background: #f3f6fa;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.run-error-title {
  font-weight: 700;
}
.run-error-detail {
  display: grid;
  gap: 5px;
  line-height: 1.6;
}
.run-error-action {
  color: #7a889d;
  font-size: 12px;
}
.run-payload-grid {
  display: grid;
  gap: 12px;
}
.run-payload-grid article {
  display: grid;
  gap: 7px;
}
.run-payload-grid article > strong {
  color: #526176;
  font-size: 12px;
}
.run-detail-tabs {
  margin-top: 18px;
}
.checkpoint-list {
  display: grid;
  gap: 12px;
}
.checkpoint-list article {
  overflow: hidden;
  border: 1px solid #e4eaf2;
  border-radius: 11px;
}
.checkpoint-list header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  color: #526176;
  background: #f8fafc;
}
.checkpoint-list pre {
  max-height: 260px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  color: #334155;
  background: #fff;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.el-timeline-item p {
  margin: 5px 0;
  color: #526176;
}
.version-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 11px;
  background: #f6f9fd;
}
.version-toolbar p {
  margin: 0;
  color: #65748a;
  font-size: 12px;
}
@media (max-width: 1100px) {
  .agent-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .agent-overview,
  .agent-form-grid {
    grid-template-columns: 1fr;
  }
  .filter-form--agent {
    grid-template-columns: 1fr !important;
  }
  .version-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .run-summary-card {
    grid-template-columns: 1fr;
  }
}
</style>
