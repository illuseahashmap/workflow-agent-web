<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { RefreshCw, Search } from '@lucide/vue'
import ListEmptyState from '@/components/ListEmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import TablePagination from '@/components/TablePagination.vue'
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
  applied.value = {
    pageNum: 1,
    pageSize: applied.value.pageSize,
    eventType: optionalFilter(filters.eventType),
    processInstanceId: optionalFilter(filters.processInstanceId),
    traceId: optionalFilter(filters.traceId),
  }
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
  <main class="page-content operations-page">
    <PageHeader
      eyebrow="OPERATIONS"
      title="运行审计"
      description="按租户追踪流程操作、执行主体与 Trace，定位一次运行的完整链路。"
    />
    <section class="filter-card operations-filter" aria-label="审计筛选">
      <label
        >事件类型<input
          v-model="filters.eventType"
          placeholder="例如 TASK_APPROVED"
          @keyup.enter="search"
      /></label>
      <label
        >流程实例<input
          v-model="filters.processInstanceId"
          placeholder="输入实例 ID"
          @keyup.enter="search"
      /></label>
      <label
        >Trace ID<input v-model="filters.traceId" placeholder="输入 Trace ID" @keyup.enter="search"
      /></label>
      <div class="filter-actions">
        <el-button type="primary" :loading="query.isFetching.value" @click="search"
          ><Search :size="15" />查询</el-button
        ><el-button @click="reset"><RefreshCw :size="15" />重置</el-button>
      </div>
    </section>
    <section class="table-panel operations-table-panel">
      <div class="section-heading operations-section-heading">
        <div>
          <h2>操作事件</h2>
          <p>按发生时间倒序显示，敏感凭证不会出现在审计记录中。</p>
        </div>
      </div>
      <div v-if="showInitialLoading" class="operations-loading" aria-live="polite">
        <span class="operations-loading__spinner" aria-hidden="true"></span>
        <span>正在读取审计事件…</span>
      </div>
      <template v-else>
        <el-table :data="records" class="operations-table">
          <el-table-column prop="eventType" label="事件" min-width="170" />
          <el-table-column prop="subject" label="对象" min-width="190" show-overflow-tooltip />
          <el-table-column
            prop="processInstanceId"
            label="流程实例"
            min-width="190"
            show-overflow-tooltip
          />
          <el-table-column prop="actorUsername" label="操作者" width="130" />
          <el-table-column prop="nextState" label="结果" min-width="130" />
          <el-table-column prop="traceId" label="Trace ID" min-width="210" show-overflow-tooltip />
          <el-table-column label="发生时间" width="175"
            ><template #default="{ row }">{{
              formatDateTime(row.occurredAt)
            }}</template></el-table-column
          >
        </el-table>
        <ListEmptyState
          v-if="records.length === 0"
          title="暂无审计事件"
          description="流程发生操作后，事件会自动出现在这里。"
        />
      </template>
      <TablePagination
        v-if="!showInitialLoading"
        :total="total"
        :current-page="applied.pageNum"
        :page-size="applied.pageSize"
        @update:current-page="changePage"
        @update:page-size="changePageSize"
      />
    </section>
  </main>
</template>

<style scoped>
.operations-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.operations-filter {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.2fr) minmax(220px, 1.2fr) auto;
  align-items: end;
  gap: 14px;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--panel-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-panel);
}
.operations-filter label {
  display: grid;
  gap: 7px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 650;
}
.operations-filter input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--control-radius);
  color: var(--color-text);
  background: var(--color-surface);
  outline: none;
}
.operations-filter input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
.filter-actions {
  display: flex;
  gap: 8px;
}
.section-heading h2 {
  margin: 0;
  font-size: 16px;
}
.section-heading p {
  margin: 5px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}
.operations-table-panel {
  grid-template-rows: auto minmax(300px, 1fr) auto;
  min-height: 520px;
}
.operations-section-heading {
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--color-border-soft);
}
.operations-loading {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
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
@media (max-width: 980px) {
  .operations-filter {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 620px) {
  .operations-filter {
    grid-template-columns: 1fr;
  }
}
</style>
