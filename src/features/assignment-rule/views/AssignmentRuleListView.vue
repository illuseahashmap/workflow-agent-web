<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { Plus, RefreshCw, Search, Trash2 } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import MetricCard from '@/components/MetricCard.vue'
import PageHeader from '@/components/PageHeader.vue'
import { definitionApi } from '@/features/process-definition/api'
import type { ProcessDefinition } from '@/features/process-definition/types'
import { useAuthStore } from '@/stores/auth'
import { listUserTasks, resolveTaskMode } from '@/utils/bpmn'
import { confirmAction } from '@/utils/confirmation'
import type { BpmnTaskMode, BpmnUserTask } from '@/utils/bpmn'
import { formatDateTime, formatVersion, joinValues, splitValues } from '@/utils/format'
import { assignmentRuleApi } from '../api'
import type {
  AssignmentRule,
  AssignmentRuleCommand,
  AssignmentType,
  EmptyUserStrategy,
  RuleOperator,
} from '../types'
import '../styles.css'

const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const query = reactive({
  pageNum: 1,
  pageSize: 20,
  processDefinitionKey: '',
  processDefinitionId: '',
  version: undefined as number | undefined,
  taskDefinitionKey: '',
  variableName: '',
  assignmentType: undefined as AssignmentType | undefined,
  emptyUserStrategy: undefined as EmptyUserStrategy | undefined,
})
const applied = ref({ ...query })
const dialogVisible = ref(false)
const editingId = ref<number>()
const form = reactive({
  processDefinitionKey: '',
  processDefinitionId: '',
  taskDefinitionKey: '',
  priority: 100,
  assignmentType: 'ASSIGNEE' as AssignmentType,
  assignees: '',
  candidateUsers: '',
  countersignUsers: '',
  emptyUserStrategy: 'AUTO_REJECT' as EmptyUserStrategy,
  fallbackAssignee: '',
  enabled: true,
  description: '',
  conditions: [] as Array<{ variableName: string; operator: RuleOperator; variableValue: string }>,
})
const defaultAssignmentTypeByMode: Record<BpmnTaskMode, AssignmentType> = {
  single: 'ASSIGNEE',
  candidate: 'CANDIDATE_USERS',
  parallel: 'COUNTERSIGN_USERS',
}

const rulesQuery = useQuery({
  queryKey: computed(() => queryKeys.assignmentRulePage(tenantCode.value, applied.value)),
  queryFn: () => assignmentRuleApi.page(applied.value),
})
const records = computed(() => rulesQuery.data.value?.records ?? [])
const total = computed(() => rulesQuery.data.value?.total ?? 0)
const enabledCount = computed(() => records.value.filter((item) => item.enabled).length)
const disabledCount = computed(() => Math.max(records.value.length - enabledCount.value, 0))
const processCatalogQuery = useQuery({
  queryKey: computed(() => queryKeys.processDefinitionCatalog(tenantCode.value)),
  queryFn: () => definitionApi.listProcesses(),
})
const versionsQuery = useQuery({
  queryKey: computed(() =>
    queryKeys.processDefinitionVersions(tenantCode.value, form.processDefinitionKey),
  ),
  queryFn: () => definitionApi.listVersions(form.processDefinitionKey),
  enabled: computed(() => Boolean(form.processDefinitionKey)),
})
const selectedProcessDefinition = computed(() =>
  versionsQuery.data.value?.find((item) => item.processDefinitionId === form.processDefinitionId),
)
const definitionDetailQuery = useQuery({
  queryKey: computed(() =>
    queryKeys.processDefinitionDetail(
      tenantCode.value,
      form.processDefinitionKey,
      selectedProcessDefinition.value?.version,
    ),
  ),
  queryFn: () =>
    definitionApi.detail(form.processDefinitionKey, selectedProcessDefinition.value!.version),
  enabled: computed(
    () =>
      dialogVisible.value &&
      Boolean(form.processDefinitionKey) &&
      Boolean(selectedProcessDefinition.value?.version),
  ),
})
const availableUserTasks = computed(() => {
  const bpmnXml = definitionDetailQuery.data.value?.bpmnXml
  return bpmnXml ? listUserTasks(bpmnXml) : []
})

const saveMutation = useMutation({
  mutationFn: async () => {
    const command = buildCommand()
    const definition = selectedDefinition()
    if (!definition) throw new Error('请选择有效的流程版本')
    const definitionDetail =
      definitionDetailQuery.data.value ??
      (await definitionApi.detail(definition.processDefinitionKey, definition.version))
    validateCommand(command, definitionDetail)
    return editingId.value
      ? assignmentRuleApi.update(editingId.value, command)
      : assignmentRuleApi.create(command)
  },
  onSuccess: async () => {
    dialogVisible.value = false
    ElMessage.success(editingId.value ? '派单规则已修改' : '派单规则已新增')
    await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentRules(tenantCode.value) })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

function targetValues(rule: AssignmentRule, type: string) {
  return rule.targets
    .filter((target) => target.targetType === type)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((target) => target.targetValue)
}
function buildCommand(): AssignmentRuleCommand {
  return {
    processDefinitionId: form.processDefinitionId,
    taskDefinitionKey: form.taskDefinitionKey.trim(),
    priority: Number(form.priority),
    assignmentType: form.assignmentType,
    assignees: splitValues(form.assignees),
    candidateUsers: splitValues(form.candidateUsers),
    candidateGroups: [],
    countersignUsers: splitValues(form.countersignUsers),
    emptyUserStrategy: form.emptyUserStrategy,
    fallbackAssignee: form.fallbackAssignee.trim() || undefined,
    enabled: form.enabled,
    description: form.description.trim() || undefined,
    conditions: form.conditions
      .filter((item) => item.variableName.trim())
      .map((item, index) => ({
        variableName: item.variableName.trim(),
        operator: item.operator,
        variableValue: ['EXISTS', 'NOT_EXISTS'].includes(item.operator)
          ? ''
          : item.variableValue.trim(),
        sortOrder: (index + 1) * 10,
      })),
  }
}
function selectedDefinition() {
  return selectedProcessDefinition.value
}
function validateCommand(command: AssignmentRuleCommand, definition: ProcessDefinition) {
  if (!command.processDefinitionId || !command.taskDefinitionKey)
    throw new Error('流程版本和节点标识不能为空')
  const mode = resolveTaskMode(definition.bpmnXml, command.taskDefinitionKey)
  if (!mode) throw new Error('流程版本中不存在该 UserTask 节点')
  const allowed: Record<string, AssignmentType[]> = {
    single: ['ASSIGNEE'],
    candidate: ['CANDIDATE_USERS'],
    parallel: ['COUNTERSIGN_USERS'],
  }
  if (!allowed[mode]!.includes(command.assignmentType))
    throw new Error(
      `当前节点是${{ single: '单人', candidate: '候选', parallel: '会签' }[mode]}模式，派单类型不匹配`,
    )
  if (command.assignmentType === 'ASSIGNEE' && command.assignees.length !== 1)
    throw new Error('请填写一个处理人账号')
  if (command.assignmentType === 'CANDIDATE_USERS' && !command.candidateUsers.length)
    throw new Error('请填写候选人')
  if (command.assignmentType === 'COUNTERSIGN_USERS' && !command.countersignUsers.length)
    throw new Error('请填写会签人')
  if (command.emptyUserStrategy === 'TO_ASSIGNEE' && !command.fallbackAssignee)
    throw new Error('转给兜底处理人时必须填写兜底处理人')
  for (const condition of command.conditions)
    if (!['EXISTS', 'NOT_EXISTS'].includes(condition.operator) && !condition.variableValue)
      throw new Error('条件变量值不能为空')
}
function resetForm() {
  editingId.value = undefined
  Object.assign(form, {
    processDefinitionKey: '',
    processDefinitionId: '',
    taskDefinitionKey: '',
    priority: 100,
    assignmentType: 'ASSIGNEE',
    assignees: '',
    candidateUsers: '',
    countersignUsers: '',
    emptyUserStrategy: 'AUTO_REJECT',
    fallbackAssignee: '',
    enabled: true,
    description: '',
    conditions: [],
  })
}
function openCreate() {
  resetForm()
  dialogVisible.value = true
}
function openEdit(rule: AssignmentRule) {
  editingId.value = rule.id
  Object.assign(form, {
    processDefinitionKey: rule.processDefinitionKey,
    processDefinitionId: rule.processDefinitionId,
    taskDefinitionKey: rule.taskDefinitionKey,
    priority: rule.priority,
    assignmentType: normalizeAssignmentType(rule.assignmentType),
    assignees: joinValues(targetValues(rule, 'ASSIGNEE')),
    candidateUsers: joinValues(targetValues(rule, 'CANDIDATE_USER')),
    countersignUsers: joinValues(targetValues(rule, 'COUNTERSIGN_USER')),
    emptyUserStrategy: rule.emptyUserStrategy,
    fallbackAssignee: targetValues(rule, 'FALLBACK_ASSIGNEE')[0] || '',
    enabled: rule.enabled,
    description: rule.description || '',
    conditions: rule.conditions.map((item) => ({
      variableName: item.variableName,
      operator: item.operator,
      variableValue: item.variableValue || '',
    })),
  })
  dialogVisible.value = true
}
function changeProcessDefinition() {
  form.processDefinitionId = ''
  form.taskDefinitionKey = ''
}
function changeProcessVersion() {
  form.taskDefinitionKey = ''
}
function changeTaskDefinition(taskDefinitionKey: string) {
  const task = availableUserTasks.value.find((item) => item.id === taskDefinitionKey)
  if (!task) return
  form.assignmentType = defaultAssignmentTypeByMode[task.mode]
  form.assignees = ''
  form.candidateUsers = ''
  form.countersignUsers = ''
}
function search() {
  query.pageNum = 1
  applied.value = { ...query }
}
function reset() {
  Object.assign(query, {
    processDefinitionKey: '',
    processDefinitionId: '',
    version: undefined,
    taskDefinitionKey: '',
    variableName: '',
    assignmentType: undefined,
    emptyUserStrategy: undefined,
    pageNum: 1,
  })
  applied.value = { ...query }
}
function changePage(pageNum: number, pageSize: number) {
  query.pageNum = pageNum
  query.pageSize = pageSize
  applied.value = { ...query }
}
function addCondition() {
  form.conditions.push({ variableName: '', operator: 'EQ', variableValue: '' })
}
async function remove(rule: AssignmentRule) {
  const confirmed = await confirmAction(
    `确认删除 ${rule.taskDefinitionKey} 的派单规则？`,
    '删除派单规则',
    {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    },
  )
  if (!confirmed) return
  try {
    await assignmentRuleApi.delete(rule.id)
    ElMessage.success('派单规则已删除')
    await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentRules(tenantCode.value) })
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}
async function toggleEnabled(rule: AssignmentRule) {
  const command = {
    processDefinitionId: rule.processDefinitionId,
    taskDefinitionKey: rule.taskDefinitionKey,
    priority: rule.priority,
    assignmentType: rule.assignmentType,
    assignees: targetValues(rule, 'ASSIGNEE'),
    candidateUsers: targetValues(rule, 'CANDIDATE_USER'),
    candidateGroups: targetValues(rule, 'CANDIDATE_GROUP'),
    countersignUsers: targetValues(rule, 'COUNTERSIGN_USER'),
    emptyUserStrategy: rule.emptyUserStrategy,
    fallbackAssignee: targetValues(rule, 'FALLBACK_ASSIGNEE')[0],
    enabled: !rule.enabled,
    description: rule.description,
    conditions: rule.conditions.map(({ variableName, operator, variableValue, sortOrder }) => ({
      variableName,
      operator,
      variableValue,
      sortOrder,
    })),
  }
  try {
    await assignmentRuleApi.update(rule.id, command)
    ElMessage.success(command.enabled ? '规则已启用' : '规则已停用')
    await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentRules(tenantCode.value) })
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}
function processLabel(item: ProcessDefinition) {
  return `${item.processDefinitionName} / ${item.processDefinitionKey}`
}
function versionLabel(item: ProcessDefinition) {
  const status = item.active ? '当前发布' : '可维护'
  return `${formatVersion(item.version)} · ${status} · ${formatDateTime(item.deployedAt)}`
}
function taskLabel(task: BpmnUserTask) {
  return `${task.name} / ${task.id} · ${taskModeLabel(task.mode)}`
}
function taskModeLabel(mode: BpmnTaskMode) {
  return { single: '单人', candidate: '候选', parallel: '会签' }[mode]
}
function assignmentTypeLabel(type: AssignmentType) {
  return {
    ASSIGNEE: '处理人',
    CANDIDATE_USERS: '候选人',
    CANDIDATE_GROUPS: '候选人',
    COUNTERSIGN_USERS: '会签人',
    MIXED: '候选人',
  }[type]
}
function normalizeAssignmentType(type: AssignmentType): AssignmentType {
  return ['CANDIDATE_USERS', 'CANDIDATE_GROUPS', 'MIXED'].includes(type) ? 'CANDIDATE_USERS' : type
}
function conditionsText(rule: AssignmentRule) {
  return rule.conditions.length
    ? rule.conditions
        .map(
          (item) =>
            `${item.variableName} ${item.operator}${['EXISTS', 'NOT_EXISTS'].includes(item.operator) ? '' : ` ${item.variableValue}`}`,
        )
        .join(' 且 ')
    : '无条件'
}
function assignmentTargetsText(rule: AssignmentRule) {
  return joinValues(
    rule.targets
      .filter((item) => item.targetType !== 'FALLBACK_ASSIGNEE')
      .map((item) => item.targetValue),
  )
}
</script>

<template>
  <div class="management-page page-stack">
    <PageHeader
      eyebrow="Assignment Rule"
      title="派单规则中心"
      description="按流程版本和 UserTask 节点维护派单策略，统一管理处理人、候选人、会签与空人员兜底规则。"
    />

    <section class="metric-grid">
      <MetricCard :value="total" label="规则总数"><template #icon>Σ</template></MetricCard>
      <MetricCard :value="enabledCount" label="当前页启用" tone="success">
        <template #icon>✓</template>
      </MetricCard>
      <MetricCard :value="disabledCount" label="当前页停用" tone="warning">
        <template #icon>–</template>
      </MetricCard>
    </section>

    <section class="page-actions compact-filter">
      <el-form class="filter-form filter-form--assignment" inline @submit.prevent="search"
        ><el-form-item label="流程标识"
          ><el-input v-model="query.processDefinitionKey" clearable /></el-form-item
        ><el-form-item label="版本"
          ><el-input-number
            v-model="query.version"
            :min="1"
            controls-position="right" /></el-form-item
        ><el-form-item label="节点"
          ><el-input v-model="query.taskDefinitionKey" clearable /></el-form-item
        ><el-form-item label="变量名"
          ><el-input v-model="query.variableName" clearable /></el-form-item
        ><el-form-item label="派单类型"
          ><el-select v-model="query.assignmentType" clearable
            ><el-option label="处理人" value="ASSIGNEE" /><el-option
              label="候选人"
              value="CANDIDATE_USERS" /><el-option
              label="会签人"
              value="COUNTERSIGN_USERS" /></el-select></el-form-item
        ><el-form-item class="filter-form__actions"
          ><el-button type="primary" native-type="submit"><Search :size="16" />查询</el-button
          ><el-button @click="reset"><RefreshCw :size="16" />重置</el-button></el-form-item
        ></el-form
      ><el-button class="page-primary-action" type="primary" @click="openCreate"
        ><Plus :size="17" />新增规则</el-button
      >
    </section>
    <section class="table-panel">
      <el-table v-loading="rulesQuery.isFetching.value" :data="records" height="100%"
        ><el-table-column
          prop="processDefinitionKey"
          label="流程标识"
          min-width="160"
        /><el-table-column label="流程版本" width="110"
          ><template #default="{ row }">{{ formatVersion(row.version) }}</template></el-table-column
        ><el-table-column
          prop="taskDefinitionKey"
          label="节点标识"
          min-width="160"
        /><el-table-column label="条件（全部满足）" min-width="260" show-overflow-tooltip
          ><template #default="{ row }">{{ conditionsText(row) }}</template></el-table-column
        ><el-table-column prop="priority" label="优先级" width="85" /><el-table-column
          label="派单类型"
          width="110"
          ><template #default="{ row }">{{
            assignmentTypeLabel(row.assignmentType)
          }}</template></el-table-column
        ><el-table-column label="目标" min-width="200" show-overflow-tooltip
          ><template #default="{ row }">{{
            assignmentTargetsText(row) || '-'
          }}</template></el-table-column
        ><el-table-column label="启用" width="80"
          ><template #default="{ row }"
            ><el-switch
              :model-value="row.enabled"
              @change="toggleEnabled(row)" /></template></el-table-column
        ><el-table-column label="更新时间" width="175"
          ><template #default="{ row }">{{
            formatDateTime(row.updatedAt)
          }}</template></el-table-column
        ><el-table-column label="操作" width="130" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openEdit(row)">修改</el-button
            ><el-button link type="danger" @click="remove(row)"
              ><Trash2 :size="14" />删除</el-button
            ></template
          ></el-table-column
        ><template #empty><div class="empty-copy">暂无派单规则</div></template></el-table
      ><el-pagination
        class="table-pagination"
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @change="changePage"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '修改派单规则' : '新增派单规则'"
      width="900px"
      destroy-on-close
    >
      <el-form class="rule-form" label-position="top">
        <el-alert
          v-if="editingId"
          title="历史版本规则可以持续维护；流程版本与节点绑定不可修改。"
          type="info"
          :closable="false"
          show-icon
          class="rule-binding-alert"
        />
        <div class="form-grid">
          <el-form-item label="流程" required
            ><el-select
              v-model="form.processDefinitionKey"
              class="assignment-rule-select"
              :class="{ 'has-value': Boolean(form.processDefinitionKey) }"
              filterable
              :loading="processCatalogQuery.isFetching.value"
              :disabled="Boolean(editingId)"
              @change="changeProcessDefinition"
              ><el-option
                v-for="item in processCatalogQuery.data.value ?? []"
                :key="item.processDefinitionKey"
                :label="processLabel(item)"
                :value="item.processDefinitionKey" /></el-select></el-form-item
          ><el-form-item label="目标版本" required
            ><el-select
              v-model="form.processDefinitionId"
              class="assignment-rule-select"
              :class="{ 'has-value': Boolean(form.processDefinitionId) }"
              filterable
              :loading="versionsQuery.isFetching.value"
              :disabled="Boolean(editingId) || !form.processDefinitionKey"
              placeholder="请选择需要维护的版本"
              @change="changeProcessVersion"
              ><el-option
                v-for="item in versionsQuery.data.value ?? []"
                :key="item.processDefinitionId"
                :label="versionLabel(item)"
                :value="item.processDefinitionId" /></el-select></el-form-item
          ><el-form-item label="任务节点" required
            ><el-select
              v-model="form.taskDefinitionKey"
              class="assignment-rule-select"
              :class="{ 'has-value': Boolean(form.taskDefinitionKey) }"
              filterable
              :loading="definitionDetailQuery.isFetching.value"
              :disabled="
                Boolean(editingId) ||
                !form.processDefinitionId ||
                definitionDetailQuery.isFetching.value
              "
              placeholder="请选择该版本的任务节点"
              no-data-text="该版本没有可配置的用户任务"
              @change="changeTaskDefinition"
              ><el-option
                v-for="task in availableUserTasks"
                :key="task.id"
                :label="taskLabel(task)"
                :value="task.id"
                ><div class="task-option">
                  <span>{{ task.name }}</span>
                  <small>{{ task.id }} · {{ taskModeLabel(task.mode) }}</small>
                </div></el-option
              ></el-select
            ></el-form-item
          ><el-form-item label="优先级"
            ><el-input-number v-model="form.priority" :min="0" :max="9999" /></el-form-item
          ><el-form-item label="派单类型" required
            ><div
              class="assignment-type-indicator"
              :class="{ 'is-empty': !form.taskDefinitionKey }"
            >
              <span class="assignment-type-indicator__dot" aria-hidden="true" />
              <strong>{{
                form.taskDefinitionKey ? assignmentTypeLabel(form.assignmentType) : '待识别'
              }}</strong>
              <span class="assignment-type-indicator__hint">{{
                form.taskDefinitionKey ? '根据任务节点自动识别' : '请先选择任务节点'
              }}</span>
            </div></el-form-item
          >
        </div>
        <el-form-item
          v-if="form.taskDefinitionKey && form.assignmentType === 'ASSIGNEE'"
          label="处理人"
          required
          ><el-input v-model="form.assignees" placeholder="请输入处理人账号" /></el-form-item
        ><el-form-item
          v-if="form.taskDefinitionKey && form.assignmentType === 'CANDIDATE_USERS'"
          label="候选人"
          required
          ><el-input v-model="form.candidateUsers" placeholder="多个账号用逗号分隔" /></el-form-item
        ><el-form-item
          v-if="form.taskDefinitionKey && form.assignmentType === 'COUNTERSIGN_USERS'"
          label="会签人"
          required
          ><el-input v-model="form.countersignUsers" placeholder="多个账号用逗号分隔"
        /></el-form-item>
        <div class="subsection-heading">
          <h3>匹配条件</h3>
          <el-button link type="primary" @click="addCondition"
            ><Plus :size="15" />添加条件</el-button
          >
        </div>
        <div v-for="(condition, index) in form.conditions" :key="index" class="condition-row">
          <el-input v-model="condition.variableName" placeholder="变量名" /><el-select
            v-model="condition.operator"
            ><el-option
              v-for="operator in [
                'EQ',
                'NE',
                'EXISTS',
                'NOT_EXISTS',
                'IN',
                'NOT_IN',
                'GT',
                'GE',
                'LT',
                'LE',
              ]"
              :key="operator"
              :label="operator"
              :value="operator" /></el-select
          ><el-input
            v-model="condition.variableValue"
            :disabled="['EXISTS', 'NOT_EXISTS'].includes(condition.operator)"
            placeholder="比较值"
          /><el-button
            text
            type="danger"
            aria-label="删除条件"
            @click="form.conditions.splice(index, 1)"
            ><Trash2 :size="16"
          /></el-button>
        </div>
        <div class="form-grid">
          <el-form-item label="空人员策略"
            ><el-select v-model="form.emptyUserStrategy"
              ><el-option label="转给兜底处理人" value="TO_ASSIGNEE" /><el-option
                label="自动完成"
                value="AUTO_COMPLETE" /><el-option
                label="自动驳回"
                value="AUTO_REJECT" /></el-select></el-form-item
          ><el-form-item v-if="form.emptyUserStrategy === 'TO_ASSIGNEE'" label="兜底处理人" required
            ><el-input
              v-model="form.fallbackAssignee"
              placeholder="请输入兜底处理人账号" /></el-form-item
          ><el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
        </div>
        <el-form-item label="说明">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saveMutation.isPending.value"
          :disabled="
            !form.processDefinitionId ||
            !form.taskDefinitionKey ||
            versionsQuery.isFetching.value ||
            definitionDetailQuery.isFetching.value
          "
          @click="saveMutation.mutate()"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>
