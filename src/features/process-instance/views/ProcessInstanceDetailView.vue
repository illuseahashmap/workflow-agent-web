<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Ban, RefreshCw, Send } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import {
  displayValue,
  formatDateTime,
  formatDuration,
  joinValues,
  splitValues,
} from '@/utils/format'
import ProcessDiagram from '../components/ProcessDiagram.vue'
import { processInstanceApi } from '../api'
import type { TaskItem } from '../types'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const id = computed(() => String(route.params.id))
const activeTab = ref('diagram')
const taskPage = reactive({ pageNum: 1, pageSize: 10 })
const variablePage = reactive({ pageNum: 1, pageSize: 10 })
const transferVisible = ref(false)
const selectedTask = ref<TaskItem>()
const transferForm = reactive({
  targetAssignee: '',
  targetCandidateUsers: '',
  targetCandidateGroups: '',
  comment: '',
})

const detailQuery = useQuery({
  queryKey: computed(() => ['process-instance-detail', id.value]),
  queryFn: () => processInstanceApi.detail(id.value),
})
const diagramQuery = useQuery({
  queryKey: computed(() => ['process-instance-diagram', id.value]),
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
    if (!task?.assignee) throw new Error('候选任务需要接入当前用户身份后才能安全转办')
    if (
      !transferForm.targetAssignee.trim() &&
      !transferForm.targetCandidateUsers.trim() &&
      !transferForm.targetCandidateGroups.trim()
    )
      throw new Error('至少填写一种转办目标')
    return processInstanceApi.transfer({
      taskId: task.taskId,
      currentAssignee: task.assignee,
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

async function refresh() {
  await Promise.all([detailQuery.refetch(), diagramQuery.refetch()])
  await queryClient.invalidateQueries({ queryKey: ['process-instances'] })
}
async function terminate() {
  const result = await ElMessageBox.prompt('请输入终止原因。该操作无法撤销。', '终止流程实例', {
    confirmButtonText: '终止',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '终止原因不能为空',
  })
  terminateMutation.mutate(result.value.trim())
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
      <el-tag :type="instance?.status === 'RUNNING' ? 'success' : 'info'" effect="plain">{{
        instance?.status === 'RUNNING' ? '运行中' : '已结束'
      }}</el-tag>
      <div class="toolbar-spacer" />
      <el-button @click="refresh"><RefreshCw :size="16" />刷新</el-button>
      <el-button v-if="instance?.status === 'RUNNING'" type="danger" plain @click="terminate"
        ><Ban :size="16" />终止流程</el-button
      >
    </header>
    <section class="instance-summary">
      <div>
        <span>业务标识</span><strong>{{ instance?.businessKey || '-' }}</strong>
      </div>
      <div>
        <span>流程版本</span><strong>v{{ instance?.processDefinitionVersion || '-' }}</strong>
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
          ><ProcessDiagram :data="diagramQuery.data.value"
        /></el-tab-pane>
        <el-tab-pane :label="`任务 (${detailQuery.data.value?.tasks.length || 0})`" name="tasks">
          <el-table :data="visibleTasks" height="470"
            ><el-table-column prop="taskName" label="任务" min-width="150" /><el-table-column
              prop="taskDefinitionKey"
              label="节点标识"
              min-width="150"
            /><el-table-column prop="assignee" label="处理人" width="130" /><el-table-column
              label="候选用户/组"
              min-width="200"
              ><template #default="{ row }">{{
                joinValues([...(row.candidateUsers || []), ...(row.candidateGroups || [])]) || '-'
              }}</template></el-table-column
            ><el-table-column prop="status" label="状态" width="100" /><el-table-column
              label="开始时间"
              width="175"
              ><template #default="{ row }">{{
                formatDateTime(row.startTime)
              }}</template></el-table-column
            ><el-table-column label="耗时" width="130"
              ><template #default="{ row }">{{
                formatDuration(row.durationInMillis)
              }}</template></el-table-column
            ><el-table-column label="操作" width="100" fixed="right"
              ><template #default="{ row }"
                ><el-tooltip :disabled="Boolean(row.assignee)" content="候选任务需接入当前用户身份"
                  ><span
                    ><el-button
                      link
                      type="primary"
                      :disabled="row.status !== 'RUNNING' || !row.assignee"
                      @click="openTransfer(row)"
                      ><Send :size="15" />转办</el-button
                    ></span
                  ></el-tooltip
                ></template
              ></el-table-column
            ></el-table
          >
          <el-pagination
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
              width="130"
            /><el-table-column label="值" min-width="260" show-overflow-tooltip
              ><template #default="{ row }"
                ><code>{{ displayValue(row.value) }}</code></template
              ></el-table-column
            ><el-table-column prop="taskId" label="关联任务" min-width="180" /><el-table-column
              label="更新时间"
              width="175"
              ><template #default="{ row }">{{
                formatDateTime(row.lastUpdatedTime || row.createTime)
              }}</template></el-table-column
            ></el-table
          >
          <el-pagination
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

    <el-dialog v-model="transferVisible" title="转办任务" width="560px">
      <el-alert type="info" :closable="false" title="处理人、候选用户和候选组至少填写一项" />
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
