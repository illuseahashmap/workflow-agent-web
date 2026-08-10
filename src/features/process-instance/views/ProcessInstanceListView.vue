<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Ban, Eye, Play, RefreshCw, Search } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import ListEmptyState from '@/components/ListEmptyState.vue'
import MetricCard from '@/components/MetricCard.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { canOperateInstances as isInstanceOperable } from '@/features/auth/authorization'
import { useAuthStore } from '@/stores/auth'
import { promptRequired } from '@/utils/confirmation'
import { formatDateTime, formatDuration } from '@/utils/format'
import { processInstanceApi } from '../api'
import StartProcessDialog from '../components/StartProcessDialog.vue'
import type { StartProcessResult } from '../types'

const router = useRouter()
const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const canOperateInstances = computed(() => isInstanceOperable(authStore.user))
const query = reactive({
  processDefinitionKey: '',
  processDefinitionName: '',
  processInstanceId: '',
  businessKey: '',
  status: 'all' as 'all' | 'running' | 'finished',
  pageNum: 1,
  pageSize: 20,
})
const applied = ref({ ...query })
const startVisible = ref(false)

const instancesQuery = useQuery({
  queryKey: computed(() => queryKeys.processInstancePage(tenantCode.value, applied.value)),
  queryFn: () => processInstanceApi.page(applied.value),
})

const records = computed(() => instancesQuery.data.value?.records ?? [])
const total = computed(() => instancesQuery.data.value?.total ?? 0)
const runningCount = computed(
  () => records.value.filter((item) => item.status === 'RUNNING').length,
)
const finishedCount = computed(() => Math.max(records.value.length - runningCount.value, 0))

const terminateMutation = useMutation({
  mutationFn: ({ id, reason }: { id: string; reason: string }) =>
    processInstanceApi.terminate(id, reason),
  onSuccess: async () => {
    ElMessage.success('流程实例已终止')
    await queryClient.invalidateQueries({ queryKey: queryKeys.processInstances(tenantCode.value) })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

function search() {
  query.pageNum = 1
  applied.value = { ...query }
}

function reset() {
  Object.assign(query, {
    processDefinitionKey: '',
    processDefinitionName: '',
    processInstanceId: '',
    businessKey: '',
    status: 'all',
    pageNum: 1,
  })
  applied.value = { ...query }
}

function changePage(pageNum: number, pageSize: number) {
  query.pageNum = pageNum
  query.pageSize = pageSize
  applied.value = { ...query }
}

async function terminate(id: string) {
  const reason = await promptRequired('请输入终止原因。该操作无法撤销。', '终止流程实例', {
    confirmButtonText: '终止',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '终止原因不能为空',
  })
  if (!reason) return
  terminateMutation.mutate({ id, reason })
}

function handleStarted(result: StartProcessResult) {
  void router.push({ name: 'process-instance-detail', params: { id: result.processInstanceId } })
}
</script>

<template>
  <div class="management-page page-stack">
    <PageHeader
      eyebrow="Process Instance"
      title="流程实例看板"
      description="追踪流程运行状态、当前任务、业务标识和执行耗时，快速定位需要人工处理的流程实例。"
    >
      <template v-if="canOperateInstances" #actions>
        <el-button type="primary" @click="startVisible = true">
          <Play :size="16" />发起流程
        </el-button>
      </template>
    </PageHeader>

    <section class="metric-grid">
      <MetricCard :value="total" label="实例总数"><template #icon>Σ</template></MetricCard>
      <MetricCard :value="runningCount" label="当前页运行中" tone="success">
        <template #icon>▶</template>
      </MetricCard>
      <MetricCard :value="finishedCount" label="当前页已结束" tone="warning">
        <template #icon>✓</template>
      </MetricCard>
    </section>

    <section class="page-actions compact-filter filter-only">
      <el-form class="filter-form filter-form--instances" inline @submit.prevent="search">
        <el-form-item label="流程标识"
          ><el-input v-model="query.processDefinitionKey" clearable
        /></el-form-item>
        <el-form-item label="流程名称"
          ><el-input v-model="query.processDefinitionName" clearable
        /></el-form-item>
        <el-form-item label="实例 ID"
          ><el-input v-model="query.processInstanceId" clearable
        /></el-form-item>
        <el-form-item label="业务标识"
          ><el-input v-model="query.businessKey" clearable
        /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status"
            ><el-option label="全部" value="all" /><el-option
              label="运行中"
              value="running" /><el-option label="已结束" value="finished"
          /></el-select>
        </el-form-item>
        <el-form-item class="filter-form__actions"
          ><el-button type="primary" native-type="submit"><Search :size="16" />查询</el-button
          ><el-button @click="reset"><RefreshCw :size="16" />重置</el-button></el-form-item
        >
      </el-form>
    </section>
    <section class="table-panel">
      <el-table
        v-loading="instancesQuery.isFetching.value"
        :data="records"
        height="100%"
        table-layout="fixed"
      >
        <el-table-column
          prop="businessKey"
          label="业务标识"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="processDefinitionName"
          label="流程名称"
          min-width="170"
          show-overflow-tooltip
        />
        <el-table-column
          prop="processInstanceId"
          label="实例 ID"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column prop="startUserId" label="发起人" width="120" show-overflow-tooltip />
        <el-table-column label="状态" width="110" align="center" header-align="center"
          ><template #default="{ row }"
            ><StatusBadge :status="row.status === 'RUNNING' ? 'RUNNING' : 'COMPLETED'" /></template
        ></el-table-column>
        <el-table-column label="发起时间" min-width="175"
          ><template #default="{ row }">{{
            formatDateTime(row.startTime)
          }}</template></el-table-column
        >
        <el-table-column label="耗时" width="130"
          ><template #default="{ row }">{{
            formatDuration(row.durationInMillis)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="170" fixed="right"
          ><template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="
                router.push({
                  name: 'process-instance-detail',
                  params: { id: row.processInstanceId },
                })
              "
              ><Eye :size="15" />详情</el-button
            >
            <el-button
              v-if="canOperateInstances && row.status === 'RUNNING'"
              link
              type="danger"
              @click="terminate(row.processInstanceId)"
              ><Ban :size="15" />终止</el-button
            >
          </template></el-table-column
        >
        <template #empty>
          <ListEmptyState
            title="暂无流程实例"
            description="调整筛选条件，或从已发布的流程定义发起一个新实例。"
          />
        </template>
      </el-table>
      <el-pagination
        v-accessible-label="'每页条数'"
        aria-label="流程实例分页"
        class="table-pagination"
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @change="changePage"
      />
    </section>

    <StartProcessDialog v-model="startVisible" @started="handleStarted" />
  </div>
</template>
