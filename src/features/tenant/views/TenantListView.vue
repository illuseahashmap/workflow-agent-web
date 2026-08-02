<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshCw, Search } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { formatDateTime } from '@/utils/format'
import { tenantApi } from '../api'
import type { TenantCommand, WorkflowTenant } from '../types'

const queryClient = useQueryClient()
const query = reactive({
  keyword: '',
  enabled: undefined as boolean | undefined,
  pageNum: 1,
  pageSize: 20,
})
const applied = ref({ ...query })
const dialogVisible = ref(false)
const editingId = ref<number>()
const form = reactive<TenantCommand>({
  tenantId: '',
  tenantCode: '',
  tenantName: '',
  description: '',
  enabled: true,
})
const tenantsQuery = useQuery({
  queryKey: computed(() => ['tenants', applied.value]),
  queryFn: () => tenantApi.page(applied.value),
})
const records = computed(() => tenantsQuery.data.value?.records ?? [])
const total = computed(() => tenantsQuery.data.value?.total ?? 0)
const enabledCount = computed(() => records.value.filter((item) => item.enabled).length)
const disabledCount = computed(() => Math.max(records.value.length - enabledCount.value, 0))
const enabledTenantsQuery = useQuery({
  queryKey: ['enabled-tenants'],
  queryFn: tenantApi.enabled,
  enabled: false,
})
const saveMutation = useMutation({
  mutationFn: async () => {
    if (!form.tenantId.trim() || !form.tenantCode.trim() || !form.tenantName.trim())
      throw new Error('租户标识、编码和名称不能为空')
    const payload = {
      ...form,
      tenantId: form.tenantId.trim(),
      tenantCode: form.tenantCode.trim(),
      tenantName: form.tenantName.trim(),
      description: form.description?.trim(),
    }
    if (editingId.value) await tenantApi.update(editingId.value, payload)
    else await tenantApi.create(payload)
  },
  onSuccess: async () => {
    dialogVisible.value = false
    ElMessage.success(editingId.value ? '租户已修改' : '租户已创建')
    await queryClient.invalidateQueries({ queryKey: ['tenants'] })
    await queryClient.invalidateQueries({ queryKey: ['enabled-tenants'] })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
function search() {
  query.pageNum = 1
  applied.value = { ...query }
}
function reset() {
  Object.assign(query, { keyword: '', enabled: undefined, pageNum: 1 })
  applied.value = { ...query }
}
function changePage(pageNum: number, pageSize: number) {
  query.pageNum = pageNum
  query.pageSize = pageSize
  applied.value = { ...query }
}
async function refreshEnabledTenants() {
  const result = await enabledTenantsQuery.refetch()
  if (result.error) return ElMessage.error(getErrorMessage(result.error))
  ElMessage.success(`已刷新 ${result.data?.length ?? 0} 个可用租户`)
}
function create() {
  editingId.value = undefined
  Object.assign(form, {
    tenantId: '',
    tenantCode: '',
    tenantName: '',
    description: '',
    enabled: true,
  })
  dialogVisible.value = true
}
function edit(item: WorkflowTenant) {
  editingId.value = item.id
  Object.assign(form, {
    tenantId: item.tenantId,
    tenantCode: item.tenantCode,
    tenantName: item.tenantName,
    description: item.description || '',
    enabled: item.enabled,
  })
  dialogVisible.value = true
}
async function toggle(item: WorkflowTenant) {
  const next = !item.enabled
  await ElMessageBox.confirm(
    `${next ? '启用' : '禁用'}租户“${item.tenantName}”可能影响该租户下的流程访问，是否继续？`,
    `${next ? '启用' : '禁用'}租户`,
    { confirmButtonText: next ? '启用' : '禁用', cancelButtonText: '取消', type: 'warning' },
  )
  try {
    await tenantApi.updateEnabled(item.id, next)
    ElMessage.success(next ? '租户已启用' : '租户已禁用')
    await queryClient.invalidateQueries({ queryKey: ['tenants'] })
    await queryClient.invalidateQueries({ queryKey: ['enabled-tenants'] })
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}
</script>

<template>
  <div class="definition-page page-stack">
    <section class="page-hero compact-hero">
      <div>
        <span class="eyebrow">Tenant</span>
        <h2>租户管理中心</h2>
        <p>维护工作流租户、租户编码和启停状态，为流程定义与实例提供隔离边界。</p>
      </div>
    </section>

    <section class="metric-grid">
      <article class="metric-card">
        <span>Σ</span>
        <div>
          <strong>{{ total }}</strong>
          <small>租户总数</small>
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
          <small>当前页禁用</small>
        </div>
      </article>
    </section>

    <section class="page-actions compact-filter">
      <el-form class="filter-form filter-form--tenants" inline @submit.prevent="search"
        ><el-form-item label="关键词"
          ><el-input
            v-model="query.keyword"
            clearable
            placeholder="租户标识、编码或名称" /></el-form-item
        ><el-form-item label="状态"
          ><el-select v-model="query.enabled" clearable
            ><el-option label="启用" :value="true" /><el-option
              label="禁用"
              :value="false" /></el-select></el-form-item
        ><el-form-item class="filter-form__actions"
          ><el-button type="primary" native-type="submit"><Search :size="16" />查询</el-button
          ><el-button @click="reset"><RefreshCw :size="16" />重置</el-button></el-form-item
        ></el-form
      >
      <div class="action-buttons page-primary-actions">
        <el-button :loading="enabledTenantsQuery.isFetching.value" @click="refreshEnabledTenants"
          ><RefreshCw :size="16" />刷新可用租户</el-button
        ><el-button type="primary" @click="create"><Plus :size="17" />新增租户</el-button>
      </div>
    </section>
    <section class="table-panel">
      <el-table v-loading="tenantsQuery.isFetching.value" :data="records" height="100%"
        ><el-table-column prop="tenantName" label="租户名称" min-width="180" /><el-table-column
          prop="tenantId"
          label="租户标识"
          min-width="180"
        /><el-table-column prop="tenantCode" label="租户编码" min-width="150" /><el-table-column
          prop="description"
          label="说明"
          min-width="220"
          show-overflow-tooltip
        /><el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">{{
              row.enabled ? '启用' : '禁用'
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="更新时间" width="175"
          ><template #default="{ row }">{{
            formatDateTime(row.updatedAt)
          }}</template></el-table-column
        ><el-table-column label="操作" width="150" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="edit(row)">编辑</el-button
            ><el-button link :type="row.enabled ? 'danger' : 'success'" @click="toggle(row)">{{
              row.enabled ? '禁用' : '启用'
            }}</el-button></template
          ></el-table-column
        ><template #empty><div class="empty-copy">暂无租户数据</div></template></el-table
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
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑租户' : '新增租户'" width="560px"
      ><el-form class="dialog-form" label-position="top"
        ><el-form-item label="租户标识" required
          ><el-input
            v-model="form.tenantId"
            :disabled="Boolean(editingId)"
            maxlength="64" /></el-form-item
        ><el-form-item label="租户编码" required
          ><el-input v-model="form.tenantCode" maxlength="64" /></el-form-item
        ><el-form-item label="租户名称" required
          ><el-input v-model="form.tenantName" maxlength="128" /></el-form-item
        ><el-form-item label="说明"
          ><el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="512"
            show-word-limit /></el-form-item
        ><el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item></el-form
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
