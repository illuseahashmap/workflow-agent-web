<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { RefreshCw, Search } from '@lucide/vue'
import ListEmptyState from '@/components/ListEmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import TablePagination from '@/components/TablePagination.vue'
import TableTagCell from '@/components/TableTagCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import DirectoryPageShell from '@/components/DirectoryPageShell.vue'
import QueryPanel from '@/components/QueryPanel.vue'
import DataTablePanel from '@/components/DataTablePanel.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'
import { operationsApi, type WorkflowAuditQuery } from '../api'

const authStore = useAuthStore()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const filters = reactive({ eventType: '', processInstanceId: '', traceId: '' })
const applied = ref<WorkflowAuditQuery>({ pageNum: 1, pageSize: 20 })
const query = useQuery({
  queryKey: computed(() => ['workflow-audit', tenantCode.value, applied.value]),
  queryFn: () => operationsApi.audit(applied.value),
  enabled: computed(() => Boolean(tenantCode.value)),
})
const records = computed(() => query.data.value?.records ?? [])
const total = computed(() => query.data.value?.total ?? 0)
const showInitialLoading = computed(() => query.isFetching.value && !query.data.value)

function optionalFilter(value: string) {
  const normalized = value.trim()
  return normalized || undefined
}

function search() {
  const nextQuery: WorkflowAuditQuery = {
    pageNum: 1,
    pageSize: applied.value.pageSize,
    eventType: optionalFilter(filters.eventType),
    processInstanceId: optionalFilter(filters.processInstanceId),
    traceId: optionalFilter(filters.traceId),
  }
  const queryUnchanged =
    applied.value.pageNum === nextQuery.pageNum &&
    applied.value.pageSize === nextQuery.pageSize &&
    applied.value.eventType === nextQuery.eventType &&
    applied.value.processInstanceId === nextQuery.processInstanceId &&
    applied.value.traceId === nextQuery.traceId
  applied.value = nextQuery
  if (queryUnchanged) void query.refetch()
}
function reset() {
  filters.eventType = ''
  filters.processInstanceId = ''
  filters.traceId = ''
  search()
}
function changePage(pageNum: number) {
  applied.value = { ...applied.value, pageNum }
}
function changePageSize(pageSize: number) {
  applied.value = { ...applied.value, pageNum: 1, pageSize }
}
</script>

<template>
  <DirectoryPageShell class="operations-page">
    <PageHeader
      eyebrow="OPERATIONS"
      title="运行审计"
      description="按租户追踪流程操作、执行主体与 Trace，定位一次运行的完整链路。"
    />
    <QueryPanel class="operations-filter" aria-label="审计筛选">
      <el-form class="filter-form filter-form--operations" inline @submit.prevent="search">
        <el-form-item label="事件类型">
          <el-input v-model="filters.eventType" clearable placeholder="例如 TASK_APPROVED" />
        </el-form-item>
        <el-form-item label="流程实例">
          <el-input v-model="filters.processInstanceId" clearable placeholder="输入实例 ID" />
        </el-form-item>
        <el-form-item label="Trace ID">
          <el-input v-model="filters.traceId" clearable placeholder="输入 Trace ID" />
        </el-form-item>
        <el-form-item class="filter-form__actions">
          <el-button type="primary" native-type="submit" :loading="query.isFetching.value">
            <Search :size="15" />查询
          </el-button>
          <el-button @click="reset"><RefreshCw :size="15" />重置</el-button>
        </el-form-item>
      </el-form>
    </QueryPanel>
    <DataTablePanel
      class="operations-table-panel"
      title="操作事件"
      description="按发生时间倒序显示，敏感凭证不会出现在审计记录中。"
    >
      <el-table
        v-loading="showInitialLoading"
        :data="records"
        class="operations-table"
        element-loading-text="正在读取审计事件…"
      >
        <el-table-column prop="eventType" label="事件" min-width="170" />
        <el-table-column prop="subject" label="对象" min-width="190" show-overflow-tooltip />
        <el-table-column
          prop="processInstanceId"
          label="流程实例"
          min-width="190"
          show-overflow-tooltip
        />
        <el-table-column prop="actorUsername" label="操作者" width="130" />
        <el-table-column prop="nextState" label="结果" min-width="130"
          ><template #default="{ row }"
            ><TableTagCell align="center"
              ><StatusBadge :status="row.nextState || 'UNKNOWN'" /></TableTagCell></template
        ></el-table-column>
        <el-table-column prop="traceId" label="Trace ID" min-width="210" show-overflow-tooltip />
        <el-table-column label="发生时间" width="175"
          ><template #default="{ row }">{{
            formatDateTime(row.occurredAt)
          }}</template></el-table-column
        >
        <template #empty>
          <ListEmptyState
            title="暂无审计事件"
            description="流程发生操作后，事件会自动出现在这里。"
          />
        </template>
      </el-table>
      <template v-if="!showInitialLoading" #footer>
        <TablePagination
          :total="total"
          :current-page="applied.pageNum"
          :page-size="applied.pageSize"
          @update:current-page="changePage"
          @update:page-size="changePageSize"
        />
      </template>
    </DataTablePanel>
  </DirectoryPageShell>
</template>

<style scoped>
.operations-table-panel {
  min-height: 520px;
}
.operations-loading {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--inline-gap);
  color: var(--color-text-muted);
  font-size: 13px;
}
.operations-loading__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-primary-soft);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  color: var(--color-primary);
  animation: operations-spin 700ms linear infinite;
}
@keyframes operations-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
