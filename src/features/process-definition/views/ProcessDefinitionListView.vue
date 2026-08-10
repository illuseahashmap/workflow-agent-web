<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Boxes,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Play,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  Trash2,
} from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import ListEmptyState from '@/components/ListEmptyState.vue'
import MetricCard from '@/components/MetricCard.vue'
import PageHeader from '@/components/PageHeader.vue'
import TableTagCell from '@/components/TableTagCell.vue'
import {
  canOperateInstances as isInstanceOperable,
  canWriteDefinitions as isDefinitionWritable,
} from '@/features/auth/authorization'
import { StartProcessDialog, type StartProcessResult } from '@/features/process-instance'
import { useAuthStore } from '@/stores/auth'
import { createBlankBpmn } from '@/utils/bpmn'
import { confirmAction } from '@/utils/confirmation'
import { formatDateTime, formatVersion } from '@/utils/format'
import { definitionApi } from '../api'
import { normalizeProcessIdentity } from '../domain'
import type { PublishStatus } from '../types'

const router = useRouter()
const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const canWriteDefinitions = computed(() => isDefinitionWritable(authStore.user))
const canOperateInstances = computed(() => isInstanceOperable(authStore.user))
const query = reactive({
  processDefinitionKey: '',
  processDefinitionName: '',
  publishStatus: 'all' as PublishStatus,
  pageNum: 1,
  pageSize: 20,
})
const applied = ref({ ...query })
const createVisible = ref(false)
const startVisible = ref(false)
const startProcessDefinitionKey = ref<string>()
const createForm = reactive({ processDefinitionKey: '', processDefinitionName: '' })

const definitionsQuery = useQuery({
  queryKey: computed(() => queryKeys.processDefinitionPage(tenantCode.value, applied.value)),
  queryFn: () => definitionApi.page(applied.value),
})

const records = computed(() => definitionsQuery.data.value?.records ?? [])
const total = computed(() => definitionsQuery.data.value?.total ?? 0)
const publishedCount = computed(() => records.value.filter((item) => item.activeVersion).length)
const draftCount = computed(() => Math.max(records.value.length - publishedCount.value, 0))

const deleteMutation = useMutation({
  mutationFn: definitionApi.deleteAll,
  onSuccess: async () => {
    ElMessage.success('流程定义已删除')
    await queryClient.invalidateQueries({
      queryKey: queryKeys.processDefinitions(tenantCode.value),
    })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

const createMutation = useMutation({
  mutationFn: async () => {
    const { key, name } = normalizeProcessIdentity(
      createForm.processDefinitionKey,
      createForm.processDefinitionName,
    )
    if (await definitionApi.exists(key)) throw new Error(`流程标识已存在：${key}`)
    return { key, name, xml: createBlankBpmn(key, name) }
  },
  onSuccess: ({ key, name, xml }) => {
    createVisible.value = false
    router.push({ name: 'process-designer', query: { key, name, draft: encodeURIComponent(xml) } })
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
    publishStatus: 'all',
    pageNum: 1,
  })
  applied.value = { ...query }
}

function changePage(pageNum: number, pageSize: number) {
  query.pageNum = pageNum
  query.pageSize = pageSize
  applied.value = { ...query }
}

async function remove(key: string, name: string) {
  const confirmed = await confirmAction(
    `将删除“${name}”的全部版本及部署数据。运行中实例可能阻止删除，是否继续？`,
    '删除流程定义',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  )
  if (!confirmed) return
  deleteMutation.mutate(key)
}

function openStart(processDefinitionKey?: string) {
  startProcessDefinitionKey.value = processDefinitionKey
  startVisible.value = true
}

function handleStarted(result: StartProcessResult) {
  void router.push({ name: 'process-instance-detail', params: { id: result.processInstanceId } })
}
</script>

<template>
  <div class="management-page page-stack">
    <PageHeader
      eyebrow="Process Definition"
      title="流程定义中心"
      description="集中管理 BPMN 模型、流程版本、发布状态和流程设计入口。"
    >
      <template v-if="canWriteDefinitions || canOperateInstances" #actions>
        <el-button v-if="canWriteDefinitions" @click="createVisible = true">
          <Plus :size="17" />新建流程
        </el-button>
        <el-button v-if="canOperateInstances" type="primary" @click="openStart()">
          <Play :size="16" />发起流程
        </el-button>
      </template>
    </PageHeader>

    <section class="metric-grid">
      <MetricCard :value="total" label="流程定义总数">
        <template #icon><Boxes :size="18" /></template>
      </MetricCard>
      <MetricCard :value="publishedCount" label="当前页已发布" tone="success">
        <template #icon><CheckCircle2 :size="18" /></template>
      </MetricCard>
      <MetricCard :value="draftCount" label="当前页未发布" tone="warning">
        <template #icon><Clock3 :size="18" /></template>
      </MetricCard>
    </section>

    <section class="page-actions compact-filter definition-filter">
      <el-form class="filter-form filter-form--definitions" inline @submit.prevent="search">
        <el-form-item label="流程标识">
          <el-input
            v-model="query.processDefinitionKey"
            clearable
            placeholder="例如 expense_approval"
          />
        </el-form-item>
        <el-form-item label="流程名称">
          <el-input v-model="query.processDefinitionName" clearable placeholder="输入流程名称" />
        </el-form-item>
        <el-form-item label="发布状态">
          <el-select
            v-model="query.publishStatus"
            v-accessible-label="'发布状态'"
            aria-label="发布状态"
          >
            <el-option label="全部" value="all" />
            <el-option label="已发布" value="published" />
            <el-option label="未发布" value="unpublished" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-form__actions">
          <div class="filter-actions">
            <el-button type="primary" native-type="submit"><Search :size="16" />查询</el-button>
            <el-button @click="reset"><RefreshCw :size="16" />重置</el-button>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel elevated-panel">
      <el-table
        class="definition-table"
        v-loading="definitionsQuery.isFetching.value"
        :data="records"
        height="100%"
        table-layout="fixed"
      >
        <el-table-column
          prop="processDefinitionName"
          label="流程"
          min-width="260"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div class="definition-name-cell">
              <span class="definition-avatar">{{
                row.processDefinitionName?.slice(0, 1) || '流'
              }}</span>
              <div>
                <strong>{{ row.processDefinitionName }}</strong>
                <small>{{ row.processDefinitionKey }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="已发布版本" width="140" header-align="center">
          <template #default="{ row }">
            <TableTagCell>
              <el-tag
                class="version-tag"
                :type="row.activeVersion ? 'success' : 'info'"
                effect="light"
                round
              >
                {{ row.activeVersion ? formatVersion(row.activeVersion) : '尚未发布' }}
              </el-tag>
            </TableTagCell>
          </template>
        </el-table-column>
        <el-table-column label="最新版本" width="130" header-align="center">
          <template #default="{ row }">
            <TableTagCell>
              <el-tag class="version-tag" type="warning" effect="light" round>
                {{ formatVersion(row.latestVersion) }}
              </el-tag>
            </TableTagCell>
          </template>
        </el-table-column>
        <el-table-column label="最新部署时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.latestDeployTime) }}</template>
        </el-table-column>
        <el-table-column v-if="canWriteDefinitions || canOperateInstances" label="操作" width="240">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button
                v-if="canOperateInstances && row.activeVersion"
                link
                type="success"
                @click="openStart(row.processDefinitionKey)"
              >
                <Play :size="14" />发起
              </el-button>
              <el-button
                v-if="canWriteDefinitions"
                link
                type="primary"
                @click="
                  router.push({
                    name: 'process-designer',
                    query: { key: row.processDefinitionKey },
                  })
                "
              >
                <SquarePen :size="14" />设计
              </el-button>
              <el-button
                v-if="canWriteDefinitions"
                link
                type="danger"
                @click="remove(row.processDefinitionKey, row.processDefinitionName)"
              >
                <Trash2 :size="14" />删除
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <ListEmptyState
            title="还没有流程定义"
            description="创建第一个 BPMN 流程，完成建模后即可发布版本并发起流程实例。"
            :icon="FilePlus2"
          >
            <el-button v-if="canWriteDefinitions" type="primary" @click="createVisible = true">
              <Plus :size="16" />新建流程
            </el-button>
          </ListEmptyState>
        </template>
      </el-table>
      <el-pagination
        v-accessible-label="'每页条数'"
        aria-label="分页"
        class="table-pagination"
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @change="changePage"
      />
    </section>

    <el-dialog v-model="createVisible" title="新建流程" width="480px" destroy-on-close>
      <el-form label-position="top" @submit.prevent="createMutation.mutate()">
        <el-form-item label="流程标识" required>
          <el-input
            v-model="createForm.processDefinitionKey"
            maxlength="64"
            placeholder="expense_approval"
          />
        </el-form-item>
        <el-form-item label="流程名称" required>
          <el-input
            v-model="createForm.processDefinitionName"
            maxlength="128"
            placeholder="费用审批"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="createMutation.isPending.value"
          @click="createMutation.mutate()"
        >
          创建并设计
        </el-button>
      </template>
    </el-dialog>

    <StartProcessDialog
      v-model="startVisible"
      :initial-process-definition-key="startProcessDefinitionKey"
      @started="handleStarted"
    />
  </div>
</template>
