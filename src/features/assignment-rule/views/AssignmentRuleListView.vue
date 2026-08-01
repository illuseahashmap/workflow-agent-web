<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshCw, Search, Trash2 } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { definitionApi } from '@/features/process-definition/api'
import type { ProcessDefinition } from '@/features/process-definition/types'
import { resolveTaskMode } from '@/utils/bpmn'
import { formatDateTime, joinValues, splitValues } from '@/utils/format'
import { assignmentRuleApi } from '../api'
import type {
  AssignmentRule,
  AssignmentRuleCommand,
  AssignmentType,
  EmptyUserStrategy,
  RuleOperator,
} from '../types'

const queryClient = useQueryClient()
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
  processDefinitionId: '',
  taskDefinitionKey: '',
  priority: 100,
  assignmentType: 'ASSIGNEE' as AssignmentType,
  assignees: '',
  candidateUsers: '',
  candidateGroups: '',
  countersignUsers: '',
  emptyUserStrategy: 'TO_ASSIGNEE' as EmptyUserStrategy,
  fallbackAssignee: '',
  enabled: true,
  description: '',
  conditions: [] as Array<{ variableName: string; operator: RuleOperator; variableValue: string }>,
})

const rulesQuery = useQuery({
  queryKey: computed(() => ['assignment-rules', applied.value]),
  queryFn: () => assignmentRuleApi.page(applied.value),
})
const records = computed(() => rulesQuery.data.value?.records ?? [])
const total = computed(() => rulesQuery.data.value?.total ?? 0)
const enabledCount = computed(() => records.value.filter((item) => item.enabled).length)
const disabledCount = computed(() => Math.max(records.value.length - enabledCount.value, 0))
const definitionsQuery = useQuery({
  queryKey: ['all-process-definition-versions'],
  queryFn: () => definitionApi.listVersions(),
})

const saveMutation = useMutation({
  mutationFn: async () => {
    const command = buildCommand()
    validateCommand(command)
    return editingId.value
      ? assignmentRuleApi.update(editingId.value, command)
      : assignmentRuleApi.create(command)
  },
  onSuccess: async () => {
    dialogVisible.value = false
    ElMessage.success(editingId.value ? '派单规则已修改' : '派单规则已新增')
    await queryClient.invalidateQueries({ queryKey: ['assignment-rules'] })
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
    candidateGroups: splitValues(form.candidateGroups),
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
  return definitionsQuery.data.value?.find(
    (item) => item.processDefinitionId === form.processDefinitionId,
  )
}
function validateCommand(command: AssignmentRuleCommand) {
  if (!command.processDefinitionId || !command.taskDefinitionKey)
    throw new Error('流程版本和节点标识不能为空')
  const definition = selectedDefinition()
  if (!definition) throw new Error('请选择有效的流程版本')
  const mode = resolveTaskMode(definition.bpmnXml, command.taskDefinitionKey)
  if (!mode) throw new Error('流程版本中不存在该 UserTask 节点')
  const allowed: Record<string, AssignmentType[]> = {
    single: ['ASSIGNEE'],
    candidate: ['CANDIDATE_USERS', 'CANDIDATE_GROUPS', 'MIXED'],
    parallel: ['COUNTERSIGN_USERS'],
  }
  if (!allowed[mode]!.includes(command.assignmentType))
    throw new Error(
      `当前节点是${{ single: '单人', candidate: '候选', parallel: '会签' }[mode]}模式，派单类型不匹配`,
    )
  if (command.assignmentType === 'ASSIGNEE' && !command.assignees.length)
    throw new Error('请填写处理人')
  if (command.assignmentType === 'CANDIDATE_USERS' && !command.candidateUsers.length)
    throw new Error('请填写候选用户')
  if (command.assignmentType === 'CANDIDATE_GROUPS' && !command.candidateGroups.length)
    throw new Error('请填写候选组')
  if (command.assignmentType === 'COUNTERSIGN_USERS' && !command.countersignUsers.length)
    throw new Error('请填写会签用户')
  if (command.emptyUserStrategy === 'TO_ASSIGNEE' && !command.fallbackAssignee)
    throw new Error('转给兜底处理人时必须填写兜底处理人')
  for (const condition of command.conditions)
    if (!['EXISTS', 'NOT_EXISTS'].includes(condition.operator) && !condition.variableValue)
      throw new Error('条件变量值不能为空')
}
function resetForm() {
  editingId.value = undefined
  Object.assign(form, {
    processDefinitionId: '',
    taskDefinitionKey: '',
    priority: 100,
    assignmentType: 'ASSIGNEE',
    assignees: '',
    candidateUsers: '',
    candidateGroups: '',
    countersignUsers: '',
    emptyUserStrategy: 'TO_ASSIGNEE',
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
    processDefinitionId: rule.processDefinitionId,
    taskDefinitionKey: rule.taskDefinitionKey,
    priority: rule.priority,
    assignmentType: rule.assignmentType,
    assignees: joinValues(targetValues(rule, 'ASSIGNEE')),
    candidateUsers: joinValues(targetValues(rule, 'CANDIDATE_USER')),
    candidateGroups: joinValues(targetValues(rule, 'CANDIDATE_GROUP')),
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
  await ElMessageBox.confirm(`确认删除 ${rule.taskDefinitionKey} 的派单规则？`, '删除派单规则', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  try {
    await assignmentRuleApi.delete(rule.id)
    ElMessage.success('派单规则已删除')
    await queryClient.invalidateQueries({ queryKey: ['assignment-rules'] })
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
    await queryClient.invalidateQueries({ queryKey: ['assignment-rules'] })
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}
function definitionLabel(item: ProcessDefinition) {
  return `${item.processDefinitionName} / ${item.processDefinitionKey} v${item.version}`
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
  <div class="definition-page page-stack">
    <section class="page-hero compact-hero">
      <div>
        <span class="eyebrow">Assignment Rule</span>
        <h2>派单规则中心</h2>
        <p>按流程版本和 UserTask 节点维护派单策略，统一管理处理人、候选人、会签与空人员兜底规则。</p>
      </div>
    </section>

    <section class="metric-grid">
      <article class="metric-card">
        <span>Σ</span>
        <div>
          <strong>{{ total }}</strong>
          <small>规则总数</small>
        </div>
      </article>
      <article class="metric-card success">
        <span>✓</span>
        <div>
          <strong>{{ enabledCount }}</strong>
          <small>当前页启用</small>
        </div>
      </article>
      <article class="metric-card warning">
        <span>–</span>
        <div>
          <strong>{{ disabledCount }}</strong>
          <small>当前页停用</small>
        </div>
      </article>
    </section>

    <section class="page-actions compact-filter">
      <el-form class="filter-form" inline @submit.prevent="search"
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
          ><el-select v-model="query.assignmentType" clearable style="width: 155px"
            ><el-option label="处理人" value="ASSIGNEE" /><el-option
              label="候选用户"
              value="CANDIDATE_USERS" /><el-option
              label="候选组"
              value="CANDIDATE_GROUPS" /><el-option
              label="会签"
              value="COUNTERSIGN_USERS" /><el-option
              label="混合候选"
              value="MIXED" /></el-select></el-form-item
        ><el-form-item
          ><el-button type="primary" native-type="submit"><Search :size="16" />查询</el-button
          ><el-button @click="reset"><RefreshCw :size="16" />重置</el-button></el-form-item
        ></el-form
      ><el-button type="primary" @click="openCreate"><Plus :size="17" />新增规则</el-button>
    </section>
    <section class="table-panel">
      <el-table
        v-loading="rulesQuery.isFetching.value"
        :data="records"
        height="100%"
        ><el-table-column
          prop="processDefinitionKey"
          label="流程标识"
          min-width="160"
        /><el-table-column prop="version" label="版本" width="75" /><el-table-column
          prop="taskDefinitionKey"
          label="节点标识"
          min-width="160"
        /><el-table-column label="条件（全部满足）" min-width="260" show-overflow-tooltip
          ><template #default="{ row }">{{ conditionsText(row) }}</template></el-table-column
        ><el-table-column prop="priority" label="优先级" width="85" /><el-table-column
          prop="assignmentType"
          label="派单类型"
          width="145"
        /><el-table-column label="目标" min-width="200" show-overflow-tooltip
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
      ><el-form class="rule-form" label-position="top"
        ><div class="form-grid">
          <el-form-item label="流程版本" required
            ><el-select v-model="form.processDefinitionId" filterable
              ><el-option
                v-for="item in definitionsQuery.data.value ?? []"
                :key="item.processDefinitionId"
                :label="definitionLabel(item)"
                :value="item.processDefinitionId" /></el-select></el-form-item
          ><el-form-item label="节点标识" required
            ><el-input
              v-model="form.taskDefinitionKey"
              placeholder="BPMN UserTask ID" /></el-form-item
          ><el-form-item label="优先级"
            ><el-input-number v-model="form.priority" :min="0" :max="9999" /></el-form-item
          ><el-form-item label="派单类型" required
            ><el-select v-model="form.assignmentType"
              ><el-option label="处理人" value="ASSIGNEE" /><el-option
                label="候选用户"
                value="CANDIDATE_USERS" /><el-option
                label="候选组"
                value="CANDIDATE_GROUPS" /><el-option
                label="会签用户"
                value="COUNTERSIGN_USERS" /><el-option label="混合候选" value="MIXED" /></el-select
          ></el-form-item>
        </div>
        <el-form-item v-if="['ASSIGNEE', 'MIXED'].includes(form.assignmentType)" label="处理人"
          ><el-input v-model="form.assignees" placeholder="多个账号用逗号分隔" /></el-form-item
        ><el-form-item
          v-if="['CANDIDATE_USERS', 'MIXED'].includes(form.assignmentType)"
          label="候选用户"
          ><el-input v-model="form.candidateUsers" placeholder="多个账号用逗号分隔" /></el-form-item
        ><el-form-item
          v-if="['CANDIDATE_GROUPS', 'MIXED'].includes(form.assignmentType)"
          label="候选组"
          ><el-input v-model="form.candidateGroups" placeholder="多个组用逗号分隔" /></el-form-item
        ><el-form-item v-if="form.assignmentType === 'COUNTERSIGN_USERS'" label="会签用户"
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
          ><el-form-item v-if="form.emptyUserStrategy === 'TO_ASSIGNEE'" label="兜底处理人"
            ><el-input v-model="form.fallbackAssignee" /></el-form-item
          ><el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
        </div>
        <el-form-item label="说明"
          ><el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit /></el-form-item></el-form
      ><template #footer
        ><el-button @click="dialogVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="saveMutation.isPending.value"
          @click="saveMutation.mutate()"
          >保存</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
