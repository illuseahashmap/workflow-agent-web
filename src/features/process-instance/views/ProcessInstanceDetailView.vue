<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Ban, Check, RefreshCw, RotateCcw, Send } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import ListEmptyState from '@/components/ListEmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { canOperateInstances as isInstanceOperable } from '@/features/auth/authorization'
import { useAuthStore } from '@/stores/auth'
import { promptRequired } from '@/utils/confirmation'
import {
  displayValue,
  formatDateTime,
  formatDuration,
  formatVersion,
  joinValues,
  splitValues,
} from '@/utils/format'
import ProcessDiagram from '../components/ProcessDiagram.vue'
import InteractionDataFields from '../components/InteractionDataFields.vue'
import ParticipantAssignmentEditor from '../components/ParticipantAssignmentEditor.vue'
import { processInstanceApi } from '../api'
import {
  buildInteractionVariables,
  synchronizeInteractionValues,
  type InteractionValues,
} from '../interaction'
import type {
  InteractionDataField,
  ParticipantAssignment,
  ParticipantRequirement,
  TaskItem,
} from '../types'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const canOperateInstances = computed(() => isInstanceOperable(authStore.user))
const id = computed(() => String(route.params.id))
const activeTab = ref('diagram')
const taskPage = reactive({ pageNum: 1, pageSize: 10 })
const variablePage = reactive({ pageNum: 1, pageSize: 10 })
const transferVisible = ref(false)
const decisionVisible = ref(false)
const decisionType = ref<'approve' | 'reject'>('approve')
const selectedTask = ref<TaskItem>()
const decisionForm = reactive({ comment: '' })
const decisionRequirements = ref<ParticipantRequirement[]>([])
const decisionAssignments = ref<ParticipantAssignment[]>([])
const decisionInteractionFields = ref<InteractionDataField[]>([])
const decisionInteractionAgentActivityIds = ref<string[]>([])
const decisionInteractionValues = ref<InteractionValues>({})
const decisionContextLoading = ref(false)
const transferForm = reactive({
  targetAssignee: '',
  targetCandidateUsers: '',
  targetCandidateGroups: '',
  comment: '',
})

const detailQuery = useQuery({
  queryKey: computed(() => queryKeys.processInstanceDetail(tenantCode.value, id.value)),
  queryFn: () => processInstanceApi.detail(id.value),
})
const diagramQuery = useQuery({
  queryKey: computed(() => queryKeys.processInstanceDiagram(tenantCode.value, id.value)),
  queryFn: () => processInstanceApi.diagram(id.value),
})
const instance = computed(() => detailQuery.data.value?.instance)
const visibleTasks = computed(() => {
  const start = (taskPage.pageNum - 1) * taskPage.pageSize
  return (detailQuery.data.value?.tasks ?? []).slice(start, start + taskPage.pageSize)
})
const visibleVariables = computed(() => {
  const start = (variablePage.pageNum - 1) * variablePage.pageSize
  return (detailQuery.data.value?.variables ?? []).slice(start, start + variablePage.pageSize)
})

const terminateMutation = useMutation({
  mutationFn: (reason: string) => processInstanceApi.terminate(id.value, reason),
  onSuccess: async () => {
    ElMessage.success('流程实例已终止')
    await refresh()
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const transferMutation = useMutation({
  mutationFn: () => {
    const task = selectedTask.value
    if (!task || !canActOnTask(task)) throw new Error('当前用户不能操作该任务')
    const targetCount = [
      transferForm.targetAssignee,
      transferForm.targetCandidateUsers,
      transferForm.targetCandidateGroups,
    ].filter((value) => value.trim()).length
    if (targetCount !== 1) throw new Error('转办目标必须且只能填写一种')
    return processInstanceApi.transfer({
      taskId: task.taskId,
      currentAssignee: task.assignee || undefined,
      currentCandidateGroups: task.candidateGroups || [],
      targetAssignee: transferForm.targetAssignee.trim() || undefined,
      targetCandidateUsers: splitValues(transferForm.targetCandidateUsers),
      targetCandidateGroups: splitValues(transferForm.targetCandidateGroups),
      comment: transferForm.comment.trim() || undefined,
    })
  },
  onSuccess: async () => {
    transferVisible.value = false
    ElMessage.success('任务已转办')
    await refresh()
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const decisionMutation = useMutation({
  mutationFn: () => {
    const task = selectedTask.value
    if (!task || !canActOnTask(task)) throw new Error('当前用户不能操作该任务')
    const variables = buildInteractionVariables(
      decisionInteractionFields.value,
      decisionInteractionValues.value,
    )
    const base = {
      taskId: task.taskId,
      currentAssignee: task.assignee || undefined,
      currentCandidateGroups: task.candidateGroups || [],
      comment: decisionForm.comment.trim() || undefined,
      variables,
      participantAssignments: decisionAssignments.value,
    }
    return decisionType.value === 'approve'
      ? processInstanceApi.approve(base)
      : processInstanceApi.reject({
          ...base,
          targetAssignees: [],
          targetCandidateGroups: [],
        })
  },
  onSuccess: async () => {
    decisionVisible.value = false
    ElMessage.success(decisionType.value === 'approve' ? '任务已同意' : '任务已退回')
    await refresh()
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const decisionRequirementsMutation = useMutation({
  mutationFn: (variables: Record<string, unknown> = {}) => {
    const task = selectedTask.value
    if (!task) throw new Error('请选择任务')
    return processInstanceApi.taskParticipantRequirements({
      taskId: task.taskId,
      action: decisionType.value === 'approve' ? 'APPROVE' : 'REJECT',
      variables,
    })
  },
  onSuccess: (requirements) => {
    decisionRequirements.value = requirements
    const activityIds = new Set(requirements.map((item) => item.activityId))
    decisionAssignments.value = decisionAssignments.value.filter((item) =>
      activityIds.has(item.activityId),
    )
  },
})

async function refresh() {
  await Promise.all([detailQuery.refetch(), diagramQuery.refetch()])
  await queryClient.invalidateQueries({ queryKey: queryKeys.processInstances(tenantCode.value) })
}
async function terminate() {
  const reason = await promptRequired('请输入终止原因。该操作无法撤销。', '终止流程实例', {
    confirmButtonText: '终止',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '终止原因不能为空',
  })
  if (!reason) return
  terminateMutation.mutate(reason)
}
function openTransfer(task: TaskItem) {
  selectedTask.value = task
  Object.assign(transferForm, {
    targetAssignee: '',
    targetCandidateUsers: '',
    targetCandidateGroups: '',
    comment: '',
  })
  transferVisible.value = true
}
function isActiveTask(task: TaskItem) {
  return ['ACTIVE', 'RUNNING'].includes(task.status)
}
function canActOnTask(task: TaskItem) {
  const username = authStore.user?.username
  return Boolean(
    canOperateInstances.value &&
    username &&
    (task.assignee === username || task.candidateUsers?.includes(username)),
  )
}
async function openDecision(task: TaskItem, type: 'approve' | 'reject') {
  selectedTask.value = task
  decisionType.value = type
  decisionForm.comment = ''
  decisionRequirements.value = []
  decisionAssignments.value = []
  decisionInteractionFields.value = []
  decisionInteractionAgentActivityIds.value = []
  decisionInteractionValues.value = {}
  decisionVisible.value = true
  decisionContextLoading.value = true
  try {
    if (type === 'approve') {
      const interaction = await processInstanceApi.taskInteraction({
        taskId: task.taskId,
        variables: {},
      })
      if (selectedTask.value?.taskId !== task.taskId || !decisionVisible.value) return
      decisionInteractionFields.value = interaction.fields
      decisionInteractionAgentActivityIds.value = interaction.agentActivityIds
      decisionInteractionValues.value = synchronizeInteractionValues(interaction.fields, {})
    }
    await decisionRequirementsMutation.mutateAsync({})
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    decisionContextLoading.value = false
  }
}
async function confirmDecision() {
  let variables: Record<string, unknown>
  try {
    variables = buildInteractionVariables(
      decisionInteractionFields.value,
      decisionInteractionValues.value,
    )
    await decisionRequirementsMutation.mutateAsync(variables)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
    return
  }
  const complete = decisionRequirements.value.every((requirement) => {
    if (!requirement.required) return true
    const users = decisionAssignments.value.find(
      (item) => item.activityId === requirement.activityId,
    )?.usernames
    return requirement.multiple ? Boolean(users?.length) : users?.length === 1
  })
  if (!complete) {
    ElMessage.warning('请为所有待派单环节选择参与人')
    return
  }
  decisionMutation.mutate()
}
</script>

<template>
  <div class="detail-page" v-loading="detailQuery.isFetching.value">
    <header class="detail-header">
      <button
        class="icon-button"
        type="button"
        aria-label="返回实例列表"
        @click="router.push('/process-instances')"
      >
        <ArrowLeft :size="18" />
      </button>
      <div>
        <h2>{{ instance?.processDefinitionName || '流程实例' }}</h2>
        <p>{{ id }}</p>
      </div>
      <StatusBadge :status="instance?.status === 'RUNNING' ? 'RUNNING' : 'COMPLETED'" />
      <div class="toolbar-spacer" />
      <el-button @click="refresh"><RefreshCw :size="16" />刷新</el-button>
      <el-button
        v-if="canOperateInstances && instance?.status === 'RUNNING'"
        type="danger"
        plain
        @click="terminate"
        ><Ban :size="16" />终止流程</el-button
      >
    </header>
    <section class="instance-summary">
      <div>
        <span>业务标识</span><strong>{{ instance?.businessKey || '-' }}</strong>
      </div>
      <div>
        <span>流程版本</span
        ><strong>{{ formatVersion(instance?.processDefinitionVersion) }}</strong>
      </div>
      <div>
        <span>发起人</span><strong>{{ instance?.startUserId || '-' }}</strong>
      </div>
      <div>
        <span>开始时间</span><strong>{{ formatDateTime(instance?.startTime) }}</strong>
      </div>
      <div>
        <span>结束时间</span><strong>{{ formatDateTime(instance?.endTime) }}</strong>
      </div>
      <div>
        <span>总耗时</span><strong>{{ formatDuration(instance?.durationInMillis) }}</strong>
      </div>
    </section>
    <section class="detail-content">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="流程跟踪" name="diagram"
          ><ProcessDiagram v-if="activeTab === 'diagram'" :data="diagramQuery.data.value"
        /></el-tab-pane>
        <el-tab-pane :label="`任务 (${detailQuery.data.value?.tasks.length || 0})`" name="tasks">
          <el-table :data="visibleTasks" height="470"
            ><el-table-column prop="taskName" label="任务" min-width="150" /><el-table-column
              prop="taskDefinitionKey"
              label="节点标识"
              min-width="150" /><el-table-column
              prop="assignee"
              label="处理人"
              width="130" /><el-table-column label="候选用户/组" min-width="200"
              ><template #default="{ row }">{{
                joinValues([...(row.candidateUsers || []), ...(row.candidateGroups || [])]) || '-'
              }}</template></el-table-column
            ><el-table-column label="状态" width="100"
              ><template #default="{ row }"
                ><StatusBadge :status="row.status" /></template></el-table-column
            ><el-table-column label="开始时间" width="175"
              ><template #default="{ row }">{{
                formatDateTime(row.startTime)
              }}</template></el-table-column
            ><el-table-column label="耗时" width="130"
              ><template #default="{ row }">{{
                formatDuration(row.durationInMillis)
              }}</template></el-table-column
            ><el-table-column v-if="canOperateInstances" label="操作" width="250" fixed="right"
              ><template #default="{ row }">
                <el-tooltip
                  :disabled="canActOnTask(row)"
                  content="仅当前处理人或候选人可以操作任务"
                >
                  <span class="row-actions">
                    <el-button
                      link
                      type="success"
                      :disabled="!isActiveTask(row) || !canActOnTask(row)"
                      @click="openDecision(row, 'approve')"
                      ><Check :size="15" />同意</el-button
                    >
                    <el-button
                      link
                      type="warning"
                      :disabled="!isActiveTask(row) || !canActOnTask(row)"
                      @click="openDecision(row, 'reject')"
                      ><RotateCcw :size="15" />退回</el-button
                    >
                    <el-button
                      link
                      type="primary"
                      :disabled="!isActiveTask(row) || !canActOnTask(row)"
                      @click="openTransfer(row)"
                      ><Send :size="15" />转办</el-button
                    >
                  </span>
                </el-tooltip>
              </template></el-table-column
            ><template #empty>
              <ListEmptyState
                compact
                title="暂无任务"
                description="流程进入人工环节后，任务会显示在这里。"
              /> </template
          ></el-table>
          <el-pagination
            v-accessible-label="'每页条数'"
            aria-label="任务分页"
            v-model:current-page="taskPage.pageNum"
            v-model:page-size="taskPage.pageSize"
            class="detail-pagination"
            :total="detailQuery.data.value?.tasks.length ?? 0"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
          />
        </el-tab-pane>
        <el-tab-pane
          :label="`变量 (${detailQuery.data.value?.variables.length || 0})`"
          name="variables"
        >
          <el-table :data="visibleVariables" height="470"
            ><el-table-column prop="variableName" label="变量名" min-width="170" /><el-table-column
              prop="variableTypeName"
              label="类型"
              width="130" /><el-table-column label="值" min-width="260" show-overflow-tooltip
              ><template #default="{ row }"
                ><code>{{ displayValue(row.value) }}</code></template
              ></el-table-column
            ><el-table-column prop="taskId" label="关联任务" min-width="180" /><el-table-column
              label="更新时间"
              width="175"
              ><template #default="{ row }">{{
                formatDateTime(row.lastUpdatedTime || row.createTime)
              }}</template></el-table-column
            ><template #empty>
              <ListEmptyState
                compact
                title="暂无流程变量"
                description="流程运行产生的业务变量会显示在这里。"
              /> </template
          ></el-table>
          <el-pagination
            v-accessible-label="'每页条数'"
            aria-label="变量分页"
            v-model:current-page="variablePage.pageNum"
            v-model:page-size="variablePage.pageSize"
            class="detail-pagination"
            :total="detailQuery.data.value?.variables.length ?? 0"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="decisionVisible"
      :title="decisionType === 'approve' ? '同意任务' : '退回任务'"
      width="min(720px, calc(100vw - 32px))"
      destroy-on-close
    >
      <el-alert
        v-if="decisionType === 'reject'"
        type="warning"
        :closable="false"
        title="任务将退回到流程中的首个人工环节。"
      />
      <el-form class="dialog-form" label-position="top">
        <el-form-item label="处理意见">
          <el-input
            v-model="decisionForm.comment"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="选填"
          />
        </el-form-item>
        <InteractionDataFields
          v-if="decisionType === 'approve'"
          v-model="decisionInteractionValues"
          :fields="decisionInteractionFields"
          :agent-activity-ids="decisionInteractionAgentActivityIds"
          :loading="decisionContextLoading"
        />
      </el-form>
      <div v-loading="decisionRequirementsMutation.isPending.value || decisionContextLoading">
        <ParticipantAssignmentEditor
          v-model="decisionAssignments"
          :requirements="decisionRequirements"
        />
      </div>
      <template #footer>
        <el-button @click="decisionVisible = false">取消</el-button>
        <el-button
          :type="decisionType === 'approve' ? 'success' : 'warning'"
          :disabled="decisionRequirementsMutation.isPending.value || decisionContextLoading"
          :loading="
            decisionMutation.isPending.value || decisionRequirementsMutation.isPending.value
          "
          @click="confirmDecision"
        >
          {{ decisionType === 'approve' ? '确认同意' : '确认退回' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="transferVisible" title="转办任务" width="min(560px, calc(100vw - 32px))">
      <el-alert
        type="info"
        :closable="false"
        title="处理人、候选用户和候选组必须且只能填写一项。"
      />
      <el-form class="dialog-form" label-position="top">
        <el-form-item label="目标处理人"
          ><el-input v-model="transferForm.targetAssignee" placeholder="用户账号"
        /></el-form-item>
        <el-form-item label="目标候选用户"
          ><el-input
            v-model="transferForm.targetCandidateUsers"
            type="textarea"
            :rows="2"
            placeholder="多个账号用逗号或换行分隔"
        /></el-form-item>
        <el-form-item label="目标候选组"
          ><el-input
            v-model="transferForm.targetCandidateGroups"
            type="textarea"
            :rows="2"
            placeholder="多个组用逗号或换行分隔"
        /></el-form-item>
        <el-form-item label="转办备注"
          ><el-input
            v-model="transferForm.comment"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="transferVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="transferMutation.isPending.value"
          @click="transferMutation.mutate()"
          >确认转办</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
